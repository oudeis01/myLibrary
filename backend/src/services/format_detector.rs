use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

#[derive(Debug, Clone, PartialEq)]
pub enum BookFormat {
    Pdf,
    Epub,
    Cbz,
}

impl BookFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            BookFormat::Pdf => "pdf",
            BookFormat::Epub => "epub",
            BookFormat::Cbz => "cbz",
        }
    }
}

pub fn detect_format(path: &Path) -> Option<BookFormat> {
    let mut file = File::open(path).ok()?;
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).ok()?;

    if &magic == b"%PDF" {
        return Some(BookFormat::Pdf);
    }

    // ZIP magic: PK\x03\x04
    if magic[0] == 0x50 && magic[1] == 0x4B && magic[2] == 0x03 && magic[3] == 0x04 {
        file.seek(SeekFrom::Start(0)).ok()?;
        return detect_zip_format(file);
    }

    None
}

fn detect_zip_format(file: File) -> Option<BookFormat> {
    let mut archive = zip::ZipArchive::new(file).ok()?;

    // EPUB: contains mimetype file with "application/epub+zip"
    if let Ok(mut mtype) = archive.by_name("mimetype") {
        let mut content = String::new();
        if mtype.read_to_string(&mut content).is_ok()
            && content.trim() == "application/epub+zip"
        {
            return Some(BookFormat::Epub);
        }
    }

    // EPUB fallback: look for .opf file
    let mut has_opf = false;
    let mut all_images = true;
    let image_exts = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index(i) {
            let name = entry.name().to_lowercase();
            if name.ends_with(".opf") {
                has_opf = true;
                break;
            }
            if entry.is_file() {
                let ext = Path::new(&name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                if !image_exts.contains(&ext) && !name.starts_with("__macosx") {
                    all_images = false;
                }
            }
        }
    }

    if has_opf {
        return Some(BookFormat::Epub);
    }

    if all_images {
        return Some(BookFormat::Cbz);
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_tmp(bytes: &[u8]) -> NamedTempFile {
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(bytes).unwrap();
        f
    }

    #[test]
    fn fd_01_pdf_magic() {
        let f = write_tmp(b"%PDF-1.4 ...");
        assert_eq!(detect_format(f.path()), Some(BookFormat::Pdf));
    }

    #[test]
    fn fd_02_empty_file() {
        let f = write_tmp(b"");
        assert_eq!(detect_format(f.path()), None);
    }

    #[test]
    fn fd_03_unknown_magic() {
        let f = write_tmp(b"\x89PNG\r\n\x1a\n");
        assert_eq!(detect_format(f.path()), None);
    }

    #[test]
    fn fd_04_nonexistent_path() {
        assert_eq!(detect_format(Path::new("/nonexistent/file.pdf")), None);
    }

    fn write_epub_zip() -> NamedTempFile {
        use std::io::Cursor;
        use zip::write::{FileOptions, ZipWriter};

        let buf = Cursor::new(Vec::new());
        let mut zw = ZipWriter::new(buf);
        let opts = FileOptions::default();
        zw.start_file("mimetype", opts).unwrap();
        zw.write_all(b"application/epub+zip").unwrap();
        zw.start_file("content.opf", opts).unwrap();
        zw.write_all(b"<package/>").unwrap();
        let buf = zw.finish().unwrap().into_inner();

        let mut f = NamedTempFile::new().unwrap();
        f.write_all(&buf).unwrap();
        f
    }

    fn write_cbz_zip() -> NamedTempFile {
        use std::io::Cursor;
        use zip::write::{FileOptions, ZipWriter};

        let buf = Cursor::new(Vec::new());
        let mut zw = ZipWriter::new(buf);
        let opts = FileOptions::default();
        zw.start_file("page001.jpg", opts).unwrap();
        zw.write_all(&[0xFF, 0xD8, 0xFF, 0xE0]).unwrap(); // fake JPEG bytes
        zw.start_file("page002.png", opts).unwrap();
        zw.write_all(&[0x89, 0x50, 0x4E, 0x47]).unwrap(); // fake PNG bytes
        let buf = zw.finish().unwrap().into_inner();

        let mut f = NamedTempFile::new().unwrap();
        f.write_all(&buf).unwrap();
        f
    }

    #[test]
    fn fd_05_epub_mimetype() {
        let f = write_epub_zip();
        assert_eq!(detect_format(f.path()), Some(BookFormat::Epub));
    }

    #[test]
    fn fd_06_cbz_all_images() {
        let f = write_cbz_zip();
        assert_eq!(detect_format(f.path()), Some(BookFormat::Cbz));
    }

    #[test]
    fn fd_07_epub_opf_fallback() {
        use std::io::Cursor;
        use zip::write::{FileOptions, ZipWriter};

        let buf = Cursor::new(Vec::new());
        let mut zw = ZipWriter::new(buf);
        let opts = FileOptions::default();
        // No mimetype file, but has .opf
        zw.start_file("OEBPS/content.opf", opts).unwrap();
        zw.write_all(b"<package/>").unwrap();
        let buf = zw.finish().unwrap().into_inner();
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(&buf).unwrap();

        assert_eq!(detect_format(f.path()), Some(BookFormat::Epub));
    }

    #[test]
    fn fd_08_three_bytes_too_short() {
        let f = write_tmp(b"PK\x03");
        assert_eq!(detect_format(f.path()), None);
    }

    #[test]
    fn fd_09_pdf_bytes_regardless_of_name() {
        // detect_format only checks magic bytes, ignores file extension
        let mut f = NamedTempFile::with_suffix(".epub").unwrap();
        f.write_all(b"%PDF-1.7 fake content").unwrap();
        assert_eq!(detect_format(f.path()), Some(BookFormat::Pdf));
    }

    #[test]
    fn fd_10_zip_with_mixed_non_image_content() {
        use std::io::Cursor;
        use zip::write::{FileOptions, ZipWriter};

        let buf = Cursor::new(Vec::new());
        let mut zw = ZipWriter::new(buf);
        let opts = FileOptions::default();
        zw.start_file("readme.txt", opts).unwrap();
        zw.write_all(b"not an ebook").unwrap();
        let buf = zw.finish().unwrap().into_inner();
        let mut f = NamedTempFile::new().unwrap();
        f.write_all(&buf).unwrap();

        // ZIP with unrecognized content → None
        assert_eq!(detect_format(f.path()), None);
    }

    #[test]
    fn fd_11_four_bytes_only_no_zip_magic() {
        // PK magic is 0x50 0x4B 0x03 0x04; this has PK but wrong type bytes
        let f = write_tmp(&[0x50, 0x4B, 0x01, 0x02, 0x00]);
        assert_eq!(detect_format(f.path()), None);
    }
}
