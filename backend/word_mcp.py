"""
VoxKage Microsoft Word Custom MCP Server Module
Handles creation, incremental section-based editing (v1 -> v2 versioning),
structured HTML/page preview rendering, and native .docx binary export.
"""

import os
import re
import json
import io
from typing import List, Dict, Any, Optional
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

class WordDocumentEngine:
    def __init__(self):
        self.documents: Dict[str, List[Dict[str, Any]]] = {}

    def create_document(
        self,
        doc_id: str,
        title: str,
        sections: List[Dict[str, Any]],
        author: str = "VoxKage AI",
        header_text: str = "VoxKage Document",
        footer_text: str = "Page {page} of {pages}",
        style: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Creates a new version 1 (v1) Word Document structure with dynamic theme styling.
        """
        style = style or {}
        doc_state = {
            "version": 1,
            "doc_id": doc_id,
            "title": title,
            "author": author,
            "header_text": header_text,
            "footer_text": footer_text,
            "style": {
                "primary_color": style.get("primary_color", "#1F497D"),
                "secondary_color": style.get("secondary_color", "#4A5568"),
                "font_family": style.get("font_family", "Calibri"),
                "font_size_body": style.get("font_size_body", 11),
                "table_header_bg": style.get("table_header_bg", style.get("primary_color", "#1F497D")),
                "table_header_color": style.get("table_header_color", "#FFFFFF"),
                "table_alternate_bg": style.get("table_alternate_bg", "#F5F0E8")
            },
            "created_at": "2026-07-28",
            "sections": sections
        }
        
        if doc_id not in self.documents:
            self.documents[doc_id] = []
        
        self.documents[doc_id].append(doc_state)
        return doc_state

    def edit_document(
        self,
        doc_id: str,
        target_heading_or_index: str,
        action: str,  # 'replace', 'append', 'insert_after', 'delete'
        new_content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Performs an incremental edit without overwriting unrelated sections,
        producing a new version (e.g. v2) while retaining v1 in history.
        """
        history = self.documents.get(doc_id, [])
        if not history:
            latest = {
                "version": 1,
                "doc_id": doc_id,
                "title": "Untitled Word Document",
                "author": "VoxKage AI",
                "header_text": "VoxKage Document",
                "footer_text": "Page {page} of {pages}",
                "style": {
                    "primary_color": "#1F497D",
                    "secondary_color": "#4A5568",
                    "font_family": "Calibri",
                    "font_size_body": 11,
                    "table_header_bg": "#1F497D",
                    "table_header_color": "#FFFFFF",
                    "table_alternate_bg": "#F5F0E8"
                },
                "sections": []
            }
        else:
            latest = json.loads(json.dumps(history[-1]))  # Deep copy previous version

        next_version = latest["version"] + 1
        latest["version"] = next_version

        sections = latest.get("sections", [])
        modified = False

        for idx, sec in enumerate(sections):
            heading = sec.get("heading", "").strip().lower()
            if target_heading_or_index.strip().lower() in heading or str(idx) == target_heading_or_index.strip():
                if action == "replace":
                    sections[idx] = new_content
                elif action in ("append", "insert_after"):
                    sections.insert(idx + 1, new_content)
                elif action == "delete":
                    sections.pop(idx)
                modified = True
                break

        if not modified:
            sections.append(new_content)

        latest["sections"] = sections
        history.append(latest)
        self.documents[doc_id] = history
        return latest

    def _hex_to_rgb(self, hex_str: str, default: str = "1F497D") -> RGBColor:
        clean = str(hex_str).lstrip("#").strip()
        if len(clean) == 3:
            clean = "".join([c * 2 for c in clean])
        if len(clean) != 6:
            clean = default.lstrip("#")
        try:
            r = int(clean[0:2], 16)
            g = int(clean[2:4], 16)
            b = int(clean[4:6], 16)
            return RGBColor(r, g, b)
        except Exception:
            return RGBColor(0x1F, 0x49, 0x7D)

    def _clean_hex(self, hex_str: str, default: str = "1F497D") -> str:
        clean = str(hex_str).lstrip("#").strip()
        if len(clean) == 3:
            clean = "".join([c * 2 for c in clean])
        if len(clean) != 6:
            return default.lstrip("#").upper()
        return clean.upper()

    def export_to_docx_bytes(self, doc_state: Any) -> bytes:
        """
        Generates binary .docx file bytes using python-docx with native OpenXML headers/footers,
        dynamic color themes, and custom styled tables.
        """
        if isinstance(doc_state, str):
            try:
                doc_state = json.loads(doc_state)
            except Exception:
                doc_state = {"title": "Document", "sections": [{"heading": "Content", "body": doc_state}]}

        if not isinstance(doc_state, dict):
            doc_state = {"title": "Document", "sections": []}

        style_opts = doc_state.get("style") or {}
        primary_hex = style_opts.get("primary_color", "#1F497D")
        secondary_hex = style_opts.get("secondary_color", "#4A5568")
        font_name = style_opts.get("font_family", "Calibri")
        table_hdr_bg = style_opts.get("table_header_bg", primary_hex)
        table_hdr_fg = style_opts.get("table_header_color", "#FFFFFF")
        table_alt_bg = style_opts.get("table_alternate_bg", "#F5F0E8")

        primary_rgb = self._hex_to_rgb(primary_hex, "1F497D")
        secondary_rgb = self._hex_to_rgb(secondary_hex, "4A5568")
        table_hdr_fg_rgb = self._hex_to_rgb(table_hdr_fg, "FFFFFF")

        doc = docx.Document()

        # Page Margins (1 inch)
        for sec in doc.sections:
            sec.top_margin = Inches(1.0)
            sec.bottom_margin = Inches(1.0)
            sec.left_margin = Inches(1.0)
            sec.right_margin = Inches(1.0)

            # Header — right aligned header_text ONLY (matches MS Word screenshot layout)
            if doc_state.get("header_text"):
                header_para = sec.header.paragraphs[0]
                header_para.text = ""
                header_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                h_run = header_para.add_run(str(doc_state["header_text"]))
                h_run.font.name = font_name
                h_run.font.size = Pt(9)
                h_run.font.color.rgb = secondary_rgb

            # Footer — parse {page} and {pages} into native OpenXML fields
            if doc_state.get("footer_text"):
                footer_para = sec.footer.paragraphs[0]
                footer_para.text = ""
                footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                footer_str = str(doc_state["footer_text"])

                # Tokenize by {page} and {pages}
                tokens = re.split(r'(\{page\}|\{pages\})', footer_str)
                for tok in tokens:
                    if tok == "{page}":
                        fld_xml = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
                        footer_para._p.append(fld_xml)
                    elif tok == "{pages}":
                        fld_xml = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls('w'))
                        footer_para._p.append(fld_xml)
                    elif tok:
                        f_run = footer_para.add_run(tok)
                        f_run.font.name = font_name
                        f_run.font.size = Pt(9)
                        f_run.font.color.rgb = secondary_rgb

        # Document Title
        title_para = doc.add_paragraph()
        title_run = title_para.add_run(str(doc_state.get("title", "Document")))
        title_run.font.name = font_name
        title_run.font.size = Pt(24)
        title_run.font.bold = True
        title_run.font.color.rgb = primary_rgb
        title_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        doc.add_paragraph()  # Spacing

        # Render Sections
        sections = doc_state.get("sections") or []
        if not isinstance(sections, list):
            sections = []

        for sec in sections:
            if not isinstance(sec, dict):
                continue

            # Handle explicit section page breaks
            if sec.get("page_break"):
                doc.add_page_break()

            heading = sec.get("heading")
            if heading:
                raw_level = sec.get("level", 1)
                try:
                    level_int = int(raw_level)
                except (ValueError, TypeError):
                    level_int = 1
                level_int = max(1, min(level_int, 3))

                h_para = doc.add_heading(level=level_int)
                h_para.paragraph_format.keep_with_next = True  # Prevent orphaned subheadings
                h_para.paragraph_format.space_before = Pt(14 if level_int == 1 else 10)
                h_para.paragraph_format.space_after = Pt(4)

                hrun = h_para.add_run(str(heading))
                hrun.font.name = font_name
                hrun.font.bold = True
                if level_int == 1:
                    hrun.font.size = Pt(18)
                    hrun.font.color.rgb = primary_rgb
                elif level_int == 2:
                    hrun.font.size = Pt(14)
                    hrun.font.color.rgb = secondary_rgb
                else:
                    hrun.font.size = Pt(12)
                    hrun.font.color.rgb = secondary_rgb

            # Paragraphs / Body text
            body = sec.get("body", "")
            if body:
                lines = str(body).split("\n")
                for line in lines:
                    line_str = line.strip()
                    if not line_str:
                        continue
                    if line_str.startswith("•") or line_str.startswith("-"):
                        bp = doc.add_paragraph(style='List Bullet')
                        r = bp.add_run(line_str.lstrip("•- "))
                        r.font.name = font_name
                        r.font.size = Pt(11)
                    else:
                        p = doc.add_paragraph()
                        p.paragraph_format.space_after = Pt(6)
                        p.paragraph_format.line_spacing = 1.15
                        r = p.add_run(line_str)
                        r.font.name = font_name
                        r.font.size = Pt(11)

            # Table (if present)
            table_data = sec.get("table")
            if table_data and isinstance(table_data, dict):
                headers = table_data.get("headers") if isinstance(table_data.get("headers"), list) else []
                rows = table_data.get("rows") if isinstance(table_data.get("rows"), list) else []

                if headers or rows:
                    first_row_len = len(rows[0]) if rows and isinstance(rows[0], list) else 1
                    t_cols = len(headers) if headers else first_row_len
                    t_rows = (1 if headers else 0) + len(rows)
                    if t_cols > 0 and t_rows > 0:
                        table = doc.add_table(rows=t_rows, cols=t_cols)
                        table.alignment = WD_TABLE_ALIGNMENT.CENTER

                        tblPr = table._tbl.tblPr
                        # Cell Margins (padding)
                        try:
                            tblCellMar = parse_xml(
                                r'<w:tblCellMar %s>'
                                r'  <w:top w:w="120" w:type="dxa"/>'
                                r'  <w:left w:w="160" w:type="dxa"/>'
                                r'  <w:bottom w:w="120" w:type="dxa"/>'
                                r'  <w:right w:w="160" w:type="dxa"/>'
                                r'</w:tblCellMar>' % nsdecls('w')
                            )
                            tblPr.append(tblCellMar)
                        except Exception:
                            pass

                        # Table Borders
                        try:
                            tblBorders = parse_xml(
                                r'<w:tblBorders %s>'
                                r'  <w:top w:val="single" w:sz="6" w:space="0" w:color="%s"/>'
                                r'  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="%s"/>'
                                r'  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E6DFD8"/>'
                                r'  <w:left w:val="none"/>'
                                r'  <w:right w:val="none"/>'
                                r'  <w:insideV w:val="none"/>'
                                r'</w:tblBorders>' % (nsdecls('w'), self._clean_hex(table_hdr_bg), self._clean_hex(table_hdr_bg))
                            )
                            tblPr.append(tblBorders)
                        except Exception:
                            pass

                        row_idx = 0
                        if headers:
                            hdr_cells = table.rows[0].cells
                            for c_idx, h_text in enumerate(headers):
                                if c_idx < len(hdr_cells):
                                    cell = hdr_cells[c_idx]
                                    cell.text = str(h_text)
                                    try:
                                        shd = parse_xml(r'<w:shd %s w:fill="%s"/>' % (nsdecls('w'), self._clean_hex(table_hdr_bg)))
                                        cell._tc.get_or_add_tcPr().append(shd)
                                        for p in cell.paragraphs:
                                            for r in p.runs:
                                                r.font.name = font_name
                                                r.font.bold = True
                                                r.font.color.rgb = table_hdr_fg_rgb
                                    except Exception:
                                        pass
                            row_idx = 1

                        for r_data_idx, r_data in enumerate(rows):
                            if isinstance(r_data, list) and row_idx < len(table.rows):
                                row_cells = table.rows[row_idx].cells
                                is_alt = (r_data_idx % 2 == 1)
                                for c_idx, cell_value in enumerate(r_data):
                                    if c_idx < len(row_cells):
                                        cell = row_cells[c_idx]
                                        cell.text = str(cell_value)
                                        if is_alt and table_alt_bg:
                                            try:
                                                shd = parse_xml(r'<w:shd %s w:fill="%s"/>' % (nsdecls('w'), self._clean_hex(table_alt_bg)))
                                                cell._tc.get_or_add_tcPr().append(shd)
                                            except Exception:
                                                pass
                                        for p in cell.paragraphs:
                                            for r in p.runs:
                                                r.font.name = font_name
                                                r.font.size = Pt(10)
                                row_idx += 1

            doc.add_paragraph()  # Spacing between sections

        target_stream = io.BytesIO()
        doc.save(target_stream)
        target_stream.seek(0)
        return target_stream.getvalue()


# Global Singleton Word Engine instance
word_engine = WordDocumentEngine()


# --- WORD MCP TOOL SCHEMAS FOR AGENT REGISTRATION ---
WORD_TOOLS = [
    {
        "name": "create_word_document",
        "description": "Create a formatted Microsoft Word document (.docx) artifact with custom color themes, typography, headings, body text, and styled tables.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "string", "description": "Unique document ID or filename slug (e.g. 'intro_report')"},
                "title": {"type": "string", "description": "Title of the Word document"},
                "sections": {
                    "type": "array",
                    "description": "List of document sections with heading, level, body text, table, or page_break",
                    "items": {
                        "type": "object",
                        "properties": {
                            "heading": {"type": "string", "description": "Section heading text"},
                            "level": {"type": "integer", "description": "Heading level 1, 2, or 3"},
                            "body": {"type": "string", "description": "Paragraph text / body content"},
                            "page_break": {"type": "boolean", "description": "Set to true to insert an explicit page break before this section"},
                            "table": {
                                "type": "object",
                                "properties": {
                                    "headers": {"type": "array", "items": {"type": "string"}},
                                    "rows": {"type": "array", "items": {"type": "array", "items": {"type": "string"}}}
                                }
                            }
                        }
                    }
                },
                "header_text": {"type": "string", "description": "Optional top header text (right-aligned)"},
                "footer_text": {"type": "string", "description": "Optional footer text format (e.g. 'Page {page} of {pages}')"},
                "style": {
                    "type": "object",
                    "description": "Optional document theme & styling parameters",
                    "properties": {
                        "primary_color": {"type": "string", "description": "Primary accent / heading color (hex string e.g. '#1F497D')"},
                        "secondary_color": {"type": "string", "description": "Secondary accent color (hex string e.g. '#4A5568')"},
                        "font_family": {"type": "string", "description": "Body and heading font family (e.g. 'Calibri', 'Arial', 'Georgia')"},
                        "font_size_body": {"type": "integer", "description": "Body font size in Pt (default: 11)"},
                        "table_header_bg": {"type": "string", "description": "Table header row background color (hex string)"},
                        "table_header_color": {"type": "string", "description": "Table header text color (hex string)"},
                        "table_alternate_bg": {"type": "string", "description": "Table alternating row background color (hex string)"}
                    }
                }
            },
            "required": ["doc_id", "title", "sections"]
        }
    },
    {
        "name": "edit_word_document",
        "description": "Incrementally edit an existing Word document artifact section-by-section, creating a new version (v2, v3) while preserving history.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "string", "description": "Document ID slug of the document to edit"},
                "target_heading_or_index": {"type": "string", "description": "Existing heading title or section index to target"},
                "action": {"type": "string", "enum": ["replace", "append", "insert_after", "delete"], "description": "Edit action to execute"},
                "new_content": {
                    "type": "object",
                    "description": "New section object with heading, level, body, or table",
                    "properties": {
                        "heading": {"type": "string"},
                        "level": {"type": "integer"},
                        "body": {"type": "string"},
                        "page_break": {"type": "boolean"},
                        "table": {"type": "object"}
                    }
                }
            },
            "required": ["doc_id", "target_heading_or_index", "action", "new_content"]
        }
    },
    {
        "name": "get_word_document",
        "description": "Retrieve current version state and structure of a Word document artifact.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "string", "description": "Document ID slug"}
            },
            "required": ["doc_id"]
        }
    },
    {
        "name": "export_word_document",
        "description": "Export the latest version of a Word document artifact as native .docx binary file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "string", "description": "Document ID slug"}
            },
            "required": ["doc_id"]
        }
    }
]


async def execute_word_tool(tool_name: str, args: dict) -> str:
    """
    Executes Microsoft Word custom MCP tools and returns JSON response / artifact state.
    """
    clean_tool = tool_name.replace("microsoft_word__", "").replace("word__", "")
    
    if clean_tool == "create_word_document":
        doc_id = args.get("doc_id") or "word_doc_" + str(int(datetime.now().timestamp()))
        title = args.get("title", "Untitled Document")
        sections = args.get("sections", [])
        author = args.get("author", "VoxKage AI")
        header_text = args.get("header_text", "VoxKage Document")
        footer_text = args.get("footer_text", "Page {page} of {pages}")
        style = args.get("style", {})
        
        doc_state = word_engine.create_document(
            doc_id=doc_id,
            title=title,
            sections=sections,
            author=author,
            header_text=header_text,
            footer_text=footer_text,
            style=style
        )
        return json.dumps({
            "status": "success",
            "message": f"Successfully created Word document '{title}' (v1). Artifact filename: '{doc_id}.docx'.",
            "artifact": {
                "name": f"{doc_id}.docx",
                "content": json.dumps(doc_state),
                "type": "word"
            },
            "doc_state": doc_state
        })

    elif clean_tool == "edit_word_document":
        doc_id = args.get("doc_id", "")
        target = args.get("target_heading_or_index", "")
        action = args.get("action", "append")
        new_content = args.get("new_content", {})

        doc_state = word_engine.edit_document(
            doc_id=doc_id,
            target_heading_or_index=target,
            action=action,
            new_content=new_content
        )
        return json.dumps({
            "status": "success",
            "message": f"Successfully updated Word document '{doc_id}' to version v{doc_state['version']}.",
            "artifact": {
                "name": f"{doc_id}.docx",
                "content": json.dumps(doc_state),
                "type": "word"
            },
            "doc_state": doc_state
        })

    elif clean_tool == "get_word_document":
        doc_id = args.get("doc_id", "")
        history = word_engine.documents.get(doc_id, [])
        if not history:
            return json.dumps({"status": "error", "message": f"Word document '{doc_id}' not found."})
        return json.dumps({"status": "success", "versions": history, "latest": history[-1]})

    elif clean_tool == "export_word_document":
        doc_id = args.get("doc_id", "")
        history = word_engine.documents.get(doc_id, [])
        if not history:
            return json.dumps({"status": "error", "message": f"Word document '{doc_id}' not found."})
        latest = history[-1]
        return json.dumps({
            "status": "success",
            "message": f"Ready for export as native .docx file.",
            "doc_id": doc_id,
            "export_url": f"/api/mcp/word/export-docx"
        })

    return json.dumps({"status": "error", "message": f"Unknown Word tool '{clean_tool}'"})

