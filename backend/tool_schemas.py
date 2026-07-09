# tool_schemas.py — Extracted tool JSON schemas for the VoxKage agent loop.
# These schemas define the function-calling interface exposed to the LLM.

TOOLS_SCHEMA = [
    # --- Web Search & Research ---
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web using DuckDuckGo for general knowledge, latest news, or current facts.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query string."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "Fetch a URL page and extract its main article text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The absolute URL to fetch."}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search_parallel",
            "description": "Search the web using DuckDuckGo for multiple queries concurrently in parallel.",
            "parameters": {
                "type": "object",
                "properties": {
                    "queries": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of query strings to search concurrently."
                    }
                },
                "required": ["queries"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch_parallel",
            "description": "Fetch multiple URLs concurrently in parallel and extract main text content from each.",
            "parameters": {
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of absolute URLs to fetch concurrently."
                    }
                },
                "required": ["urls"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search_deep",
            "description": "Perform a deep web search that queries DuckDuckGo and concurrently crawls the top page contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "browse_and_extract_tool",
            "description": "Navigate to a URL and extract text content. Falls back to search if URL is blank.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Target URL to fetch. Can be blank if query is provided."},
                    "query": {"type": "string", "description": "Optional search query fallback."}
                }
            }
        }
    },
    # --- Memory & RAG ---
    {
        "type": "function",
        "function": {
            "name": "query_rag",
            "description": "Search your own uploaded documents (PDFs, text files) semantically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query describing what to look for."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_indexed_documents",
            "description": "Retrieve a list of all permanently indexed files/documents in the RAG database, including their names, IDs, and chunk counts.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_indexed_document",
            "description": "Delete an indexed document from the RAG database by its document ID or filename to free up vector memory or prepare it for update.",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_id": {"type": "string", "description": "The unique UUID of the document to delete."},
                    "filename": {"type": "string", "description": "The exact name of the file to delete."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_user",
            "description": "Save a personal fact, preference, or habit about the user autonomously.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["identity", "preferences", "habits", "notes"], "description": "Category of fact"},
                    "key": {"type": "string", "description": "Attribute name (e.g. name, location, favorite_song)"},
                    "value": {"type": "string", "description": "Value of the fact."}
                },
                "required": ["category", "key", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recall_user",
            "description": "Recall personal details or preferences from the user profile.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Topic keywords (e.g., location, spotify). Leave blank for full profile."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "forget_user",
            "description": "Delete a personal fact, preference, or habit from the user profile.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Category of fact"},
                    "key": {"type": "string", "description": "Attribute name"}
                },
                "required": ["category", "key"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "log_problem",
            "description": "Log an unsolved technical bug or hurdle with its context for self-learning.",
            "parameters": {
                "type": "object",
                "properties": {
                    "problem": {"type": "string", "description": "Short description of the bug/problem."},
                    "context": {"type": "string", "description": "Details about how it occurred."},
                    "attempted": {"type": "string", "description": "What was attempted to resolve it."}
                },
                "required": ["problem", "context"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "log_solution",
            "description": "Log the working solution for a previously logged problem ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "problem_id": {"type": "string", "description": "The ID of the problem returned by log_problem."},
                    "solution": {"type": "string", "description": "Description of the solution."},
                    "what_worked": {"type": "string", "description": "Summary of what worked."},
                    "prevention": {"type": "string", "description": "How to prevent this bug in the future."}
                },
                "required": ["problem_id", "solution", "what_worked"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_memory",
            "description": "Find relevant past experiences, problems, and solutions semantically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query."}
                },
                "required": ["query"]
            }
        }
    },
    # --- Laptop Remote Execution ---
    {
        "type": "function",
        "function": {
            "name": "laptop_command",
            "description": "Execute a PowerShell command on the user's connected Windows laptop via the VoxKage Laptop Daemon.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "PowerShell command to execute remotely."}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_application",
            "description": "Open an installed application on the user's connected laptop.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Application name (e.g. Chrome, Discord, VS Code)."}
                },
                "required": ["app_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "close_application",
            "description": "Close a running application on the user's connected laptop.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Application name to close."}
                },
                "required": ["app_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_images",
            "description": "Fetch dynamic high-resolution image URLs for a query from free photo libraries or web search.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search term for images (e.g. 'humpback whale', 'dark nebula')."},
                    "limit": {"type": "integer", "description": "Maximum number of images to return. Default is 5."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_datetime",
            "description": "Get the current date and time.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_map",
            "description": "Render a rich interactive map explorer centered at coordinates with an optional place list explorer for multiple markers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "The latitude of the map center (e.g. 22.7196)."},
                    "longitude": {"type": "number", "description": "The longitude of the map center (e.g. 75.8577)."},
                    "label": {"type": "string", "description": "Optional overall title for the map view (e.g. 'Indore Tourism')."},
                    "places": {
                        "type": "array",
                        "description": "Optional list of multiple places/markers to render on the map and explore in the sidebar.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Name of the location (e.g. 'Rajwada Palace')."},
                                "latitude": {"type": "number", "description": "Latitude of the location marker."},
                                "longitude": {"type": "number", "description": "Longitude of the location marker."},
                                "rating": {"type": "number", "description": "Optional rating score (e.g. 4.4)."},
                                "reviews_count": {"type": "integer", "description": "Optional count of user reviews (e.g. 74096)."},
                                "description": {"type": "string", "description": "Short description of the location highlights."},
                                "category": {"type": "string", "description": "Category tag (e.g. 'Historic', 'Sights', 'Food', 'Nature')."},
                                "image_url": {"type": "string", "description": "Optional thumbnail photo URL. Highly recommended to specify if stock photo is known."}
                            },
                            "required": ["name", "latitude", "longitude"]
                        }
                    }
                },
                "required": ["latitude", "longitude"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Render a premium location-based weather forecast widget card for specific coordinates or user's local coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "Optional latitude coordinates (e.g. 20.88). If omitted, requests client browser coordinates."},
                    "longitude": {"type": "number", "description": "Optional longitude coordinates (e.g. 71.40). If omitted, requests client browser coordinates."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_chart",
            "description": "Render an interactive dark-themed Recharts analytics graph/chart (line, area, or bar chart) in the response bubble.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["line", "area", "bar"],
                        "description": "The style type of chart to render."
                    },
                    "title": {
                        "type": "string",
                        "description": "A title for the analytics chart (e.g., 'VoxKage Memory Index' or 'Weekly CPU Usage')."
                    },
                    "x_axis_label": {
                        "type": "string",
                        "description": "Optional label label for the horizontal X axis."
                    },
                    "y_axis_label": {
                        "type": "string",
                        "description": "Optional label label for the vertical Y axis."
                    },
                    "data": {
                        "type": "array",
                        "description": "List of data points to plot.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string", "description": "X-axis point label (e.g., 'Mon', '2026-Q1')."},
                                "value": {"type": "number", "description": "The numerical value to plot."},
                                "secondary_value": {"type": "number", "description": "Optional second metric value to plot for multi-line comparison."}
                            },
                            "required": ["label", "value"]
                        }
                    }
                },
                "required": ["type", "title", "data"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_flow",
            "description": "Render a clean, responsive custom SVG workflow/process flow diagram or architecture pipeline.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the flow diagram (e.g., 'Query Execution Pipeline')."
                    },
                    "nodes": {
                        "type": "array",
                        "description": "List of process nodes in the flow.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "description": "Unique node identifier (e.g., 'user_input')."},
                                "label": {"type": "string", "description": "Node title/label (e.g., 'Parse Prompt')."},
                                "description": {"type": "string", "description": "Optional short detail text below the label."},
                                "category": {"type": "string", "description": "Visual class tag (e.g. 'Process', 'System', 'Storage', 'User', 'API')."}
                            },
                            "required": ["id", "label"]
                        }
                    },
                    "edges": {
                        "type": "array",
                        "description": "List of directed connectors joining the nodes.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "from_id": {"type": "string", "description": "Source node ID matching one of the defined node IDs."},
                                "to_id": {"type": "string", "description": "Target destination node ID."},
                                "label": {"type": "string", "description": "Optional label text overlaid on the connector path."}
                            },
                            "required": ["from_id", "to_id"]
                        }
                    }
                },
                "required": ["title", "nodes", "edges"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_chemical_structure",
            "description": "Retrieve structural chemistry data (molecular weight, formula, and SVG structure skeleton) for a compound or molecule.",
            "parameters": {
                "type": "object",
                "properties": {
                    "compound_name": {
                        "type": "string",
                        "description": "Name of the chemical compound (e.g., 'Paracetamol', 'Aspirin')."
                    },
                    "smiles_notation": {
                        "type": "string",
                        "description": "Optional SMILES structure notation (e.g., 'CC(=O)NC1=CC=C(O)C=C1')."
                    }
                },
                "required": ["compound_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_timeline",
            "description": "Render a clean, collapsible vertical history event track timeline widget.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the historical timeline (e.g., 'Evolution of Web Protocols')."
                    },
                    "events": {
                        "type": "array",
                        "description": "Ordered events in the timeline.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "date": {"type": "string", "description": "Date or time period label (e.g., '1989', 'Phase 2')."},
                                "title": {"type": "string", "description": "Event heading/label."},
                                "description": {"type": "string", "description": "Optional paragraph detailing the event."},
                                "category": {"type": "string", "description": "Optional category classification tag."}
                            },
                            "required": ["date", "title"]
                        }
                    }
                },
                "required": ["title", "events"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_calculator",
            "description": "Render a live high-tech calculator widget (loan amortization, compound interest, or tax estimates) with interactive sliders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["loan", "compound", "tax"],
                        "description": "Type of calculator widget."
                    },
                    "title": {
                        "type": "string",
                        "description": "Header title of the calculator (e.g., 'Mortgage Payment Calculator')."
                    }
                },
                "required": ["type", "title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "index_document",
            "description": "Index a previously uploaded document or image into the long-term memory RAG vector database so it can be recalled in future sessions.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "The saved filename of the uploaded document (e.g. '1782785087867-resume.pdf')."},
                    "original_name": {"type": "string", "description": "The original user-facing name of the document (e.g. 'resume.pdf')."}
                },
                "required": ["filename", "original_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_code_file",
            "description": "Read the contents of any virtual code file generated in this active session workspace (e.g., telegram.py, App.tsx, styles.css, etc.). Always use this instead of laptop shell commands.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "The exact name of the file to read (e.g., 'telegram.py')."}
                },
                "required": ["filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "verify_code_file",
            "description": "Perform deep compilation and syntax checks on any virtual code file generated in this session workspace. Use this to verify your changes compile correctly without errors before delivering.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "The exact name of the file to verify (e.g., 'App.tsx')."}
                },
                "required": ["filename"]
            }
        }
    }
]
