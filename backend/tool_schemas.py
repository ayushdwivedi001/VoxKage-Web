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
    },
    {
        "type": "function",
        "function": {
            "name": "create_code_file",
            "description": "Create a virtual code file in the session workspace (e.g. 'index.html', 'grocery_app.html', 'App.tsx', 'styles.css', 'server.py'). ALWAYS call this tool first when building or creating an app, website, or multi-line code project so the file is created in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "The exact name of the file to create (e.g., 'index.html', 'grocery_app.html', 'App.tsx')."},
                    "content": {"type": "string", "description": "The complete source code or initial template content for the file."}
                },
                "required": ["filename", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_code_file",
            "description": "Update or edit an existing virtual code file in the active session workspace using replacement code or diff blocks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "The exact name of the file to update (e.g., 'index.html')."},
                    "content": {"type": "string", "description": "The new content or SEARCH/REPLACE diff block for the file."}
                },
                "required": ["filename", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "rename_session",
            "description": "Rename the current chat session to a clean, professional title. Use this as your first action if the current session name is 'New Chat'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Concise, professional title (2 to 5 words maximum) capturing the core topic of the user's initial message. No quotes, prefixes, or punctuation."
                    }
                },
                "required": ["title"]
            }
        }
    }
]
