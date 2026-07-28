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
        footer_text: str = "Page {page} of {pages}"
    ) -> Dict[str, Any]:
        """
        Creates a new version 1 (v1) Word Document structure.
        """
        doc_state = {
            "version": 1,
            "doc_id": doc_id,
            "title": title,
            "author": author,
            "header_text": header_text,
            "footer_text": footer_text,
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
            # Initialize baseline if not present
            latest = {
                "version": 1,
                "doc_id": doc_id,
                "title": "Untitled Word Document",
                "author": "VoxKage AI",
                "header_text": "VoxKage Document",
                "footer_text": "Page {page} of {pages}",
                "sections": []
            }
        else:
            latest = json.loads(json.dumps(history[-1]))  # Deep copy previous version

        next_version = latest["version"] + 1
        latest["version"] = next_version

        sections = latest.get("sections", [])
        modified = False

        # Attempt to match by heading title or index
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
            # Fallback: append section at end
            sections.append(new_content)

        latest["sections"] = sections
        history.append(latest)
        self.documents[doc_id] = history
        return latest

    def export_to_docx_bytes(self, doc_state: Any) -> bytes:
        """
        Generates binary .docx file bytes using python-docx.
        """
        if isinstance(doc_state, str):
            try:
                doc_state = json.loads(doc_state)
            except Exception:
                doc_state = {"title": "Document", "sections": [{"heading": "Content", "body": doc_state}]}

        if not isinstance(doc_state, dict):
            doc_state = {"title": "Document", "sections": []}

        doc = docx.Document()
        
        # Page Margins (1 inch)
        for sec in doc.sections:
            sec.top_margin = Inches(1.0)
            sec.bottom_margin = Inches(1.0)
            sec.left_margin = Inches(1.0)
            sec.right_margin = Inches(1.0)

            # Header
            if doc_state.get("header_text"):
                header_para = sec.header.paragraphs[0]
                header_para.text = str(doc_state["header_text"])
                header_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT

            # Footer
            if doc_state.get("footer_text"):
                footer_para = sec.footer.paragraphs[0]
                footer_para.text = str(doc_state["footer_text"])
                footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Document Title
        title_para = doc.add_paragraph()
        title_run = title_para.add_run(str(doc_state.get("title", "Document")))
        title_run.font.size = Pt(24)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(0x1F, 0x49, 0x7D)  # Corporate Word Blue
        title_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        doc.add_paragraph()  # Spacing

        # Render Sections
        sections = doc_state.get("sections") or []
        if not isinstance(sections, list):
            sections = []

        for sec in sections:
            if not isinstance(sec, dict):
                continue
            heading = sec.get("heading")
            if heading:
                raw_level = sec.get("level", 1)
                try:
                    level_int = int(raw_level)
                except (ValueError, TypeError):
                    level_int = 1
                level_int = max(1, min(level_int, 3))

                h_para = doc.add_heading(str(heading), level=level_int)
                h_para.paragraph_format.space_before = Pt(12)
                h_para.paragraph_format.space_after = Pt(6)

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
                        bp.add_run(line_str.lstrip("•- "))
                    else:
                        p = doc.add_paragraph()
                        p.paragraph_format.space_after = Pt(6)
                        p.paragraph_format.line_spacing = 1.15
                        p.add_run(line_str)

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
                        try:
                            table.style = 'Table Grid'
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
                                        shading_elm = parse_xml(r'<w:shd {} w:fill="1F497D"/>'.format(nsdecls('w')))
                                        cell._tc.get_or_add_tcPr().append(shading_elm)
                                        for p in cell.paragraphs:
                                            for r in p.runs:
                                                r.font.bold = True
                                                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                                    except Exception:
                                        pass
                            row_idx = 1

                        for r_data in rows:
                            if isinstance(r_data, list) and row_idx < len(table.rows):
                                row_cells = table.rows[row_idx].cells
                                for c_idx, cell_value in enumerate(r_data):
                                    if c_idx < len(row_cells):
                                        row_cells[c_idx].text = str(cell_value)
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
        "description": "Create a formatted Microsoft Word document (.docx) artifact with title, headings, body text, and styled tables.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "doc_id": {"type": "string", "description": "Unique document ID or filename slug (e.g. 'intro_report')"},
                "title": {"type": "string", "description": "Title of the Word document"},
                "sections": {
                    "type": "array",
                    "description": "List of document sections with heading, level, body text, or table",
                    "items": {
                        "type": "object",
                        "properties": {
                            "heading": {"type": "string", "description": "Section heading text"},
                            "level": {"type": "integer", "description": "Heading level 1, 2, or 3"},
                            "body": {"type": "string", "description": "Paragraph text / body content"},
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
                "header_text": {"type": "string", "description": "Optional top header text"},
                "footer_text": {"type": "string", "description": "Optional footer text (defaults to 'Page {page} of {pages}')"}
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
        
        doc_state = word_engine.create_document(
            doc_id=doc_id,
            title=title,
            sections=sections,
            author=author,
            header_text=header_text,
            footer_text=footer_text
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
