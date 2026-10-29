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

    token = data.get("token", "").strip()
    if not token:
        print(json.dumps({"success": False, "error": "Token N-DH is required"}))
        sys.exit(1)

    action = data.get("action", "ingest")
    if action == "get_object":
        object_id = (data.get("object_id") or "").strip()
        if not object_id:
            print(json.dumps({"success": False, "error": "object_id is required for get_object action"}))
            sys.exit(1)

        base_api = data.get("api_url", "https://datahub-api.bigdata.samsung.com")
        if base_api.endswith("/v3/objects/ingest"):
            base_api = base_api[:-len("/v3/objects/ingest")]
        base_api = base_api.rstrip("/")
        get_url = f"{base_api}/v3/objects/{object_id}"

        headers = {
            "Authorization": f"Bearer {token}",
            "X-API-KEY": token,
            "Accept": "application/json",
        }
        try:
            # ponytail: Use proxies=None to avoid proxy interception on internal intranet
            resp = requests.get(get_url, headers=headers, proxies={"http": None, "https": None}, timeout=20)
            if resp.status_code == 200:
                try:
                    obj_data = resp.json()
                except Exception:
                    obj_data = {"raw_text": resp.text}

                # Probe for parsed content if not directly present in object metadata
                has_content = bool(obj_data.get("content") or obj_data.get("parsed_content") or obj_data.get("text") or obj_data.get("extracted_text"))
                if not has_content:
                    content_endpoints = [
                        f"{base_api}/v3/objects/{object_id}/content",
                        f"{base_api}/v3/objects/{object_id}/parsed",
                        f"{base_api}/v3/objects/{object_id}?include_content=true",
                    ]
                    for ep in content_endpoints:
                        try:
                            c_resp = requests.get(ep, headers=headers, proxies={"http": None, "https": None}, timeout=15)
                            if c_resp.status_code == 200:
                                try:
                                    c_json = c_resp.json()
                                    if isinstance(c_json, dict):
                                        c_text = c_json.get("content") or c_json.get("parsed_content") or c_json.get("text") or c_json.get("extracted_text") or c_json.get("data")
                                        if c_text:
                                            obj_data["content"] = c_text
                                            has_content = True
                                            break
                                        # If JSON has nested data
                                        for k, v in c_json.items():
                                            if k not in obj_data:
                                                obj_data[k] = v
                                except Exception:
                                    if c_resp.text.strip():
                                        obj_data["content"] = c_resp.text
                                        has_content = True
                                        break
                        except Exception:
                            continue

                # Normalize parse_status across N-DH API variants
                dh_nested = obj_data.get("datahub") if isinstance(obj_data.get("datahub"), dict) else {}
                raw_status = str(
                    obj_data.get("parse_status") or
                    obj_data.get("parsing_status") or
                    obj_data.get("parsing_state") or
                    obj_data.get("process_status") or
                    dh_nested.get("parse_status") or
                    obj_data.get("status") or
                    ""
                ).strip().upper()

                if has_content:
                    obj_data["parse_status"] = "COMPLETED"
                elif raw_status in ("COMPLETED", "SUCCESS", "DONE", "FINISHED", "OK"):
                    obj_data["parse_status"] = "COMPLETED"
                elif raw_status in ("PARSING", "IN_PROGRESS", "RUNNING", "PROCESSING", "QUEUED", "QUEUE"):
                    obj_data["parse_status"] = "PARSING"
                elif raw_status in ("SKIPPED", "SKIPPED_DRM", "BYPASS"):
                    obj_data["parse_status"] = "SKIPPED_DRM"
                elif raw_status in ("FAILED", "ERROR"):
                    obj_data["parse_status"] = "FAILED"
                else:
                    obj_data["parse_status"] = raw_status if raw_status else "PENDING"

                print(json.dumps({
                    "success": True,
                    "status_code": resp.status_code,
                    "object": obj_data
                }))
                sys.exit(0)
            else:
                print(json.dumps({
                    "success": False,
                    "status_code": resp.status_code,
                    "error": f"DataHub API returned HTTP {resp.status_code}: {resp.text[:300]}"
                }))
                sys.exit(1)
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Connection error: {e}"}))
            sys.exit(1)

    api_url = data.get("api_url", "https://datahub-api.bigdata.samsung.com/v3/objects/ingest")
    if not api_url.endswith("/v3/objects/ingest"):
        api_url = api_url.rstrip("/") + "/v3/objects/ingest"

    file_path = data.get("file_path", "").strip()
    filename = data.get("filename") or os.path.basename(file_path)

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

        # Auto-retry with parsing_yn=false if DataHub rejected due to DRM_ENCRYPTED_FILE
        if failed and any("DRM_ENCRYPTED_FILE" in str(it.get("error")) for it in failed):
            if values.get("parsing_yn") != "false":
                retry_values = dict(values)
                retry_values["parsing_yn"] = "false"
                retry_values.pop("pii_tag_enabled", None)
                try:
                    with open(file_path, "rb") as retry_fobj:
                        retry_resp = requests.post(
                            api_url,
                            headers={"Authorization": f"Bearer {token}"},
                            data=retry_values,
                            files=[("files", (filename, retry_fobj))],
                            proxies={"http": None, "https": None},
                            timeout=300,
                        )
                    if retry_resp.status_code == 200:
                        retry_res = retry_resp.json()
                        retry_items = retry_res.get("items", []) if isinstance(retry_res, dict) else []
                        retry_failed = [it for it in retry_items if isinstance(it, dict) and it.get("error")]
                        if not retry_failed:
                            result = retry_res
                            items = retry_items
                            failed = []
                except Exception as ex:
                    sys.stderr.write(f"[ndh_uploader] Retry without parsing failed: {ex}\n")

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
