use crate::error::AppError;
use lopdf::Document;
use std::path::Path;
use super::BookMetadata;

pub fn extract_metadata(path: &Path) -> Result<BookMetadata, AppError> {
    let doc = Document::load(path)
        .map_err(|e| AppError::BadRequest(format!("PDF load error: {e}")))?;

    let page_count = doc.get_pages().len() as u32;

    let mut meta = BookMetadata {
        page_count: Some(page_count),
        ..Default::default()
    };

    // Locate Info dictionary
    let info_ref = doc.trailer
        .get(b"Info")
        .ok()
        .and_then(|o| o.as_reference().ok());

    if let Some(info_ref) = info_ref {
        if let Ok(lopdf::Object::Dictionary(info)) = doc.get_object(info_ref) {
            meta.title = get_pdf_str(info, b"Title");
            meta.authors = get_pdf_str(info, b"Author")
                .map(|a| vec![a])
                .unwrap_or_default();
            meta.language = get_pdf_str(info, b"Language");
            meta.description = get_pdf_str(info, b"Subject");

            if let Some(date) = get_pdf_str(info, b"CreationDate") {
                // PDF date: D:YYYYMMDDHHmmSSOHH'mm'
                meta.year = date.get(2..6).and_then(|y| y.parse().ok());
            }
        }
    }

    Ok(meta)
}

fn get_pdf_str(dict: &lopdf::Dictionary, key: &[u8]) -> Option<String> {
    dict.get(key)
        .ok()
        .and_then(|v: &lopdf::Object| v.as_str().ok())
        .map(|b| String::from_utf8_lossy(b).into_owned())
        .filter(|s: &String| !s.is_empty())
}

// PDF cover extraction requires a rendering engine (pdfium-render, etc.).
// Skipped in MVP — cover_path will be null for PDFs.
pub fn extract_cover(_path: &Path) -> Option<Vec<u8>> {
    None
}
