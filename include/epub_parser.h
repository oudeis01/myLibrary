/**
 * @file epub_parser.h
 * @brief Simple EPUB metadata parser for MyLibrary server
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-26
 */

#ifndef EPUB_PARSER_H
#define EPUB_PARSER_H

#include <string>
#include <vector>
#include <map>
#include "book_manager.h"

/**
 * @class EpubParser
 * @brief Simple EPUB metadata extraction without external dependencies
 * 
 * This class implements a lightweight EPUB parser that can extract
 * basic metadata from EPUB files using built-in ZIP handling.
 */
class EpubParser {
public:
    /**
     * @brief Extract metadata from an EPUB file
     * @param epub_path Path to the EPUB file
     * @return BookMetadata struct containing extracted information
     */
    static BookMetadata extract_metadata(const std::string& epub_path);

    /**
     * @brief Extract cover image from an EPUB file
     * @param epub_path Path to the EPUB file
     * @return Vector containing cover image data
     */
    static std::vector<unsigned char> extract_cover_image(const std::string& epub_path);

private:
    /**
     * @brief Read container.xml to find OPF file location
     * @param zip_data Raw ZIP data
     * @return Path to the OPF file within the EPUB
     */
    static std::string find_opf_file(const std::vector<unsigned char>& zip_data);

    /**
     * @brief Parse OPF file to extract metadata
     * @param opf_content Content of the OPF file
     * @return BookMetadata with extracted information
     */
    static BookMetadata parse_opf_metadata(const std::string& opf_content);

    /**
     * @brief Extract text content between XML tags
     * @param xml XML content
     * @param tag_name Tag name to search for
     * @return Content between the tags
     */
    static std::string extract_xml_tag_content(const std::string& xml, const std::string& tag_name);

    /**
     * @brief Extract attribute value from XML tag
     * @param xml XML content
     * @param tag_name Tag name
     * @param attr_name Attribute name
     * @return Attribute value
     */
    static std::string extract_xml_attribute(const std::string& xml, const std::string& tag_name, const std::string& attr_name);

    /**
     * @brief Read file from ZIP archive (simple implementation)
     * @param zip_data Raw ZIP data
     * @param file_path Path within the ZIP
     * @return File content as string
     */
    static std::string read_zip_file(const std::vector<unsigned char>& zip_data, const std::string& file_path);

    /**
     * @brief Load entire file into memory
     * @param file_path Path to the file
     * @return File content as byte vector
     */
    static std::vector<unsigned char> load_file(const std::string& file_path);
};

#endif // EPUB_PARSER_H