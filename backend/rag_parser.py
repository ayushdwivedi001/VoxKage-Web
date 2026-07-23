import os
import re
import base64
import httpx
from fastapi import HTTPException

def extract_text(file_path: str) -> str:
    """
    Extract raw text from documents. Supports PDF, DOCX, XLSX, PPTX, and standard text/code files.
    """
    _, ext = os.path.splitext(file_path.lower())
    
    # 1. Plain text and code files
    if ext in [".txt", ".md", ".json", ".csv", ".py", ".js", ".ts", ".tsx", ".html", ".css", ".yaml", ".yml", ".ini", ".conf"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read text file: {str(e)}")
            
    # 2. PDF Files
    elif ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            text_list = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(text_list)
        except ImportError:
            raise HTTPException(status_code=500, detail="PDF parser 'pypdf' is not installed.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")
            
    # 3. Word Files (DOCX)
    elif ext == ".docx":
        try:
            import docx
            doc = docx.Document(file_path)
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text)
            for table in doc.tables:
                for row in table.rows:
                    row_content = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_content:
                        full_text.append(" | ".join(row_content))
            return "\n".join(full_text)
        except ImportError:
            raise HTTPException(status_code=500, detail="Word parser 'python-docx' is not installed.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse Word Document: {str(e)}")
            
    # 4. Excel Files (XLSX)
    elif ext == ".xlsx":
        try:
            import openpyxl
            wb = openpyxl.load_workbook(file_path, data_only=True)
            text_list = []
            for sheet in wb.sheetnames:
                text_list.append(f"--- Sheet: {sheet} ---")
                ws = wb[sheet]
                for row in ws.iter_rows(values_only=True):
                    row_text = " | ".join([str(val).strip() if val is not None else "" for val in row])
                    row_text = re.sub(r"(\s*\|\s*){2,}", " | ", row_text).strip(" | ")
                    if row_text:
                        text_list.append(row_text)
            return "\n".join(text_list)
        except ImportError:
            raise HTTPException(status_code=500, detail="Excel parser 'openpyxl' is not installed.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse Excel file: {str(e)}")

    # 5. PowerPoint Files (PPTX)
    elif ext == ".pptx":
        try:
            import pptx
            prs = pptx.Presentation(file_path)
            text_list = []
            for i, slide in enumerate(prs.slides):
                text_list.append(f"--- Slide {i+1} ---")
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        text_list.append(shape.text.strip())
            return "\n".join(text_list)
        except ImportError:
            raise HTTPException(status_code=500, detail="PowerPoint parser 'python-pptx' is not installed.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse PowerPoint presentation: {str(e)}")

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}' for RAG parsing."
        )

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list:
    """
    Split text into overlapping chunks.
    """
    chunks = []
    normalized = re.sub(r"\s+", " ", text).strip()
    
    start = 0
    text_len = len(normalized)
    
    if text_len <= chunk_size:
        return [normalized] if normalized else []
        
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk = normalized[start:end]
        if chunk.strip():
            chunks.append(chunk)
        start += (chunk_size - overlap)
        
    return chunks

async def extract_text_from_image(file_path: str, model: str = None) -> str:
    target_model = model or "mimo-v2.5-free"
    
    # Determine if model is Kilo Code gateway or OpenCode
    is_kilo = "/" in target_model or "kilo" in target_model.lower() or "stepfun" in target_model.lower() or "openrouter" in target_model.lower()
    
    if is_kilo:
        api_key = os.getenv("KILO_API_KEY") or os.getenv("OPENCODE_API_KEY")
        url = "https://api.kilo.ai/api/gateway/chat/completions"
        model_id = target_model
    else:
        api_key = os.getenv("OPENCODE_API_KEY") or os.getenv("KILO_API_KEY")
        url = "https://opencode.ai/zen/v1/chat/completions"
        from opencode_client import get_opencode_model
        model_id = get_opencode_model(target_model)

    if not api_key:
        raise HTTPException(status_code=500, detail="Vision API key not configured on backend.")
        
    try:
        from io import BytesIO
        from PIL import Image
        with Image.open(file_path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            width, height = img.size
            max_size = 1560
            if max(width, height) > max_size:
                ratio = max_size / float(max(width, height))
                new_size = (int(width * ratio), int(height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            img_bytes = buf.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode("utf-8")
        image_url = f"data:image/jpeg;base64,{img_base64}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image file with PIL: {str(e)}")

    payload = {
        "model": model_id,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text", 
                        "text": "Analyze this image thoroughly. Transcribe all text, identify all objects, buildings, natural elements, colors, artistic style, atmosphere, and visual details so an AI assistant can fully understand and answer questions about it."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }
        ],
        "temperature": 0.2
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                res_data = response.json()
                description = res_data["choices"][0]["message"]["content"]
                return f"[Visual Image Content & Analysis: {os.path.basename(file_path)}]\n{description}"
            else:
                # If selected model failed or doesn't support vision, fallback to stepfun/step-3.7-flash:free on Kilo or mimo-v2.5-free on OpenCode
                fallback_kilo_key = os.getenv("KILO_API_KEY")
                if fallback_kilo_key and url != "https://api.kilo.ai/api/gateway/chat/completions":
                    fb_payload = {**payload, "model": "stepfun/step-3.7-flash:free"}
                    fb_headers = {"Authorization": f"Bearer {fallback_kilo_key}", "Content-Type": "application/json"}
                    fb_resp = await client.post("https://api.kilo.ai/api/gateway/chat/completions", headers=fb_headers, json=fb_payload)
                    if fb_resp.status_code == 200:
                        fb_data = fb_resp.json()
                        description = fb_data["choices"][0]["message"]["content"]
                        return f"[Visual Image Content & Analysis: {os.path.basename(file_path)}]\n{description}"

                try:
                    err_json = response.json()
                    err_msg = err_json.get("message") or err_json.get("detail") or response.text
                except Exception:
                    err_msg = response.text

                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Vision API error ({response.status_code}): {err_msg}"
                )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to parse image using vision model: {str(e)}")

async def extract_text_async(file_path: str, model: str = None) -> str:
    _, ext = os.path.splitext(file_path.lower())
    if ext in (".png", ".jpg", ".jpeg", ".webp"):
        return await extract_text_from_image(file_path, model=model)
    return extract_text(file_path)
