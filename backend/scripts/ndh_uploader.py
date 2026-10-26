#!/usr/bin/env python3
"""
Samsung DataHub (N-DH) Ingest Python Bridge
Replicates the working N-DH File Uploader GUI logic in headless CLI / JSON mode.
"""

import sys
import os
import json
import requests

def main():
    try:
        if len(sys.argv) > 1 and sys.argv[1].startswith("{"):
            data = json.loads(sys.argv[1])
        else:
            data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    api_url = data.get("api_url", "https://datahub-api.bigdata.samsung.com/v3/objects/ingest")
    if not api_url.endswith("/v3/objects/ingest"):
        api_url = api_url.rstrip("/") + "/v3/objects/ingest"

    token = data.get("token", "").strip()
    file_path = data.get("file_path", "").strip()
    filename = data.get("filename") or os.path.basename(file_path)

    if not token:
        print(json.dumps({"success": False, "error": "Token N-DH is required"}))
        sys.exit(1)

    if not file_path or not os.path.isfile(file_path):
        print(json.dumps({"success": False, "error": f"File not found: {file_path}"}))
        sys.exit(1)

    folder_id = (data.get("folder_id") or "").strip()
    project_id = (data.get("project_id") or "").strip()
    title = (data.get("title") or filename).strip()
    description = (data.get("description") or "").strip()
    tags = data.get("tags") or []

    # Prepare form data matching the working Python GUI
    values = {
        "overwrite": str(data.get("overwrite", True)).lower(),
        "parsing_yn": str(data.get("parsing_yn", True)).lower(),
        "ocr_enabled": str(data.get("ocr_enabled", False)).lower(),
    }

    # Destination target: mutually exclusive folder_id vs project_id
    if folder_id:
        values["folder_id"] = folder_id[:50]
    elif project_id:
        values["project_id"] = project_id[:50]

    if title:
        values["title"] = title[:50]
    if description:
        values["description"] = description[:200]
    if tags:
        clean_tags = [str(t).strip()[:20] for t in tags if str(t).strip()]
        if clean_tags:
            values["tags"] = clean_tags

    if "pii_tag_enabled" in data and data["pii_tag_enabled"] is not None:
        values["pii_tag_enabled"] = str(data["pii_tag_enabled"]).lower()

    if data.get("custom_info"):
        values["custom_info"] = json.dumps(data["custom_info"], ensure_ascii=False) if isinstance(data["custom_info"], dict) else str(data["custom_info"])

    try:
        with open(file_path, "rb") as fobj:
            response = requests.post(
                api_url,
                headers={"Authorization": f"Bearer {token}"},
                data=values,
                files=[("files", (filename, fobj))],
                proxies={"http": None, "https": None},
                timeout=300,
            )

        try:
            result = response.json()
        except Exception:
            result = {"raw": response.text}

        if response.status_code != 200:
            error_msg = f"HTTP {response.status_code}: {response.text[:300]}"
            print(json.dumps({"success": False, "status_code": response.status_code, "error": error_msg, "response": result}))
            sys.exit(0)

        # Check item errors
        items = result.get("items", []) if isinstance(result, dict) else []
        failed = [item for item in items if isinstance(item, dict) and item.get("error")]
        if failed:
            err_items = [f"{it.get('name')}: {it.get('error')}" for it in failed]
            print(json.dumps({
                "success": False,
                "status_code": 200,
                "error": "; ".join(err_items),
                "items": items,
                "response": result
            }))
            sys.exit(0)

        object_id = ""
        if items and isinstance(items[0], dict):
            object_id = items[0].get("object_id") or ""
        if not object_id and isinstance(result, dict):
            object_id = result.get("object_id") or result.get("id") or ""

        print(json.dumps({
            "success": True,
            "status_code": 200,
            "object_id": object_id,
            "items": items,
            "response": result
        }))

    except requests.exceptions.Timeout:
        print(json.dumps({"success": False, "error": "Request timeout (melebihi 300 detik)"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Exception: {str(e)}"}))

if __name__ == "__main__":
    main()
