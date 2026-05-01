use crate::error::AppError;
use std::fs::File;
use std::path::Path;
use zip::ZipArchive;
use super::BookMetadata;

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif", "bmp"];

fn is_image(name: &str) -> bool {
    let lower = name.to_lowercase();
    if lower.starts_with("__macosx") || lower.starts_with('.') {
        return false;
    }
    let ext = Path::new(&lower)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    IMAGE_EXTS.contains(&ext)
}

fn sorted_image_names(archive: &mut ZipArchive<File>) -> Vec<String> {
    // Pass 1: collect image filenames
    let mut names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|e| e.name().to_string()))
        .filter(|n| is_image(n))
        .collect();
    // Natural-ish sort: lowercase lexicographic is good enough for most CBZ naming
    names.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    names
}

pub fn extract_metadata(path: &Path) -> Result<BookMetadata, AppError> {
    let file = File::open(path)
        .map_err(|e| AppError::BadRequest(format!("CBZ open error: {e}")))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| AppError::BadRequest(format!("CBZ parse error: {e}")))?;

    let count = sorted_image_names(&mut archive).len() as u32;

    Ok(BookMetadata {
        page_count: Some(count),
        ..Default::default()
    })
}

pub fn extract_cover(path: &Path) -> Option<Vec<u8>> {
    let file = File::open(path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    let names = sorted_image_names(&mut archive);
    let first = names.first()?.clone();

    let mut entry = archive.by_name(&first).ok()?;
    let mut buf = Vec::new();
    std::io::Read::read_to_end(&mut entry, &mut buf).ok()?;
    Some(buf)
}
