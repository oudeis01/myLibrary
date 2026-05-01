use crate::error::AppError;
use epub::doc::EpubDoc;
use std::path::Path;
use super::BookMetadata;

pub fn extract_metadata(path: &Path) -> Result<BookMetadata, AppError> {
    let doc = EpubDoc::new(path)
        .map_err(|e| AppError::BadRequest(format!("EPUB load error: {e}")))?;

    #[allow(deprecated)]
    let page_count = doc.get_num_pages() as u32;

    let title = doc.mdata("title").map(|m| m.value.clone());
    let authors = doc
        .mdata("creator")
        .map(|m| vec![m.value.clone()])
        .unwrap_or_default();
    let description = doc.mdata("description").map(|m| m.value.clone());
    let language = doc.mdata("language").map(|m| m.value.clone());
    let year = doc
        .mdata("date")
        .and_then(|m| m.value.get(..4).map(|y: &str| y.to_string()))
        .and_then(|y: String| y.parse::<i32>().ok());

    Ok(BookMetadata {
        title,
        authors,
        description,
        year,
        language,
        page_count: Some(page_count),
    })
}

pub fn extract_cover(path: &Path) -> Option<Vec<u8>> {
    let mut doc = EpubDoc::new(path).ok()?;
    doc.get_cover().map(|(data, _mime)| data)
}
