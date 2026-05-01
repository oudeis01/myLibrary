use crate::{
    error::AppError,
    services::{
        format_detector::{detect_format, BookFormat},
        parser,
    },
};
use std::{fs, path::Path};
use uuid::Uuid;

#[derive(Debug, Default)]
pub struct ScanResult {
    pub added: u32,
    pub skipped: u32,
}

pub async fn scan_library(
    library_id: Uuid,
    library_path: &str,
    pool: &sqlx::PgPool,
    thumbs_path: &str,
) -> Result<ScanResult, AppError> {
    let mut result = ScanResult::default();

    fs::create_dir_all(thumbs_path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("cannot create thumbs dir: {e}")))?;

    for entry in walkdir::WalkDir::new(library_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let path_str = match path.to_str() {
            Some(s) => s,
            None => { result.skipped += 1; continue; }
        };

        // Skip already-indexed files
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM books WHERE file_path = $1)",
            path_str
        )
        .fetch_one(pool)
        .await
        .unwrap_or(Some(false))
        .unwrap_or(false);

        if exists {
            result.skipped += 1;
            continue;
        }

        let format = match detect_format(path) {
            Some(f) => f,
            None => { result.skipped += 1; continue; }
        };

        let meta = extract_metadata(path, &format);
        let file_size = fs::metadata(path).map(|m| m.len() as i64).ok();
        let cover_path = save_cover(path, &format, thumbs_path).await;

        let title = meta.title.unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });
        let format_str = format.as_str().to_string();
        let page_count = meta.page_count.map(|p| p as i32);

        sqlx::query!(
            r#"INSERT INTO books
               (library_id, title, authors, format, file_path, file_size,
                page_count, cover_path, description, year, language, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"#,
            library_id,
            title,
            &meta.authors,
            format_str,
            path_str,
            file_size,
            page_count,
            cover_path,
            meta.description,
            meta.year,
            meta.language,
            serde_json::Value::Object(Default::default()),
        )
        .execute(pool)
        .await
        .map_err(|e| tracing::warn!(path = path_str, error = %e, "insert failed"))
        .ok();

        result.added += 1;
    }

    Ok(result)
}

fn extract_metadata(path: &Path, format: &BookFormat) -> parser::BookMetadata {
    match format {
        BookFormat::Pdf => parser::pdf::extract_metadata(path).unwrap_or_default(),
        BookFormat::Epub => parser::epub::extract_metadata(path).unwrap_or_default(),
        BookFormat::Cbz => parser::cbz::extract_metadata(path).unwrap_or_default(),
    }
}

async fn save_cover(path: &Path, format: &BookFormat, thumbs_path: &str) -> Option<String> {
    let bytes = match format {
        BookFormat::Pdf => parser::pdf::extract_cover(path),
        BookFormat::Epub => parser::epub::extract_cover(path),
        BookFormat::Cbz => parser::cbz::extract_cover(path),
    }?;

    let stem = path.file_stem()?.to_str()?;
    let cover_name = format!("{stem}_{}.jpg", Uuid::new_v4());
    let cover_path = Path::new(thumbs_path).join(&cover_name);

    // Decode and re-encode as JPEG thumbnail
    let img = image::load_from_memory(&bytes).ok()?;
    let thumbnail = img.thumbnail(400, 600);
    thumbnail.save_with_format(&cover_path, image::ImageFormat::Jpeg).ok()?;

    cover_path.to_str().map(str::to_string)
}
