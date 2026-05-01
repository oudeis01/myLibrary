pub mod cbz;
pub mod epub;
pub mod pdf;

#[derive(Debug, Default)]
pub struct BookMetadata {
    pub title: Option<String>,
    pub authors: Vec<String>,
    pub description: Option<String>,
    pub year: Option<i32>,
    pub language: Option<String>,
    pub page_count: Option<u32>,
}
