import argparse
import asyncio
import json
import os
import sys

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.src.core.database import async_session, init_db
from backend.src.models.mapping import SectionMapping
from sqlalchemy import select, func, delete


async def ingest_bare_acts(file_path: str = None, reset: bool = False):
    if not file_path:
        file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "data",
            "section_mappings.json",
        )

    if not os.path.exists(file_path):
        print(f"[ERROR] File not found: {file_path}")
        return

    print(f"[INFO] Reading Bare Acts dataset from: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    mappings = data if isinstance(data, list) else data.get("mappings", [])
    print(f"[INFO] Found {len(mappings)} sections in dataset.")

    # Initialize tables if not yet created
    await init_db()

    async with async_session() as session:
        if reset:
            print("[INFO] --reset flag passed: Clearing existing section_mapping table...")
            await session.execute(delete(SectionMapping))
            await session.commit()
            print("[OK] Table cleared.")

        # Query existing (old_act, old_section) to avoid duplicates
        existing_res = await session.execute(
            select(SectionMapping.old_act, SectionMapping.old_section)
        )
        existing_keys = {
            (r[0].strip().upper(), r[1].strip().upper()) for r in existing_res.all()
        }

        inserted = 0
        skipped = 0
        act_counts = {}

        for item in mappings:
            old_act = item.get("old_act", "").strip()
            old_sec = str(item.get("old_section", "")).strip()
            new_act = item.get("new_act", "").strip()
            new_sec = str(item.get("new_section", "")).strip()

            key = (old_act.upper(), old_sec.upper())
            if key in existing_keys:
                skipped += 1
                continue

            mapping = SectionMapping(
                old_act=old_act,
                old_section=old_sec,
                old_title=item.get("old_title"),
                old_text=item.get("old_text"),
                new_act=new_act,
                new_section=new_sec,
                new_title=item.get("new_title"),
                new_text=item.get("new_text"),
                mapping_notes=item.get("mapping_notes"),
                is_identical=item.get("is_identical", False),
            )
            session.add(mapping)
            existing_keys.add(key)
            inserted += 1

            act_label = f"{old_act} <-> {new_act}"
            act_counts[act_label] = act_counts.get(act_label, 0) + 1

        await session.commit()

        total_in_db = (
            await session.execute(select(func.count(SectionMapping.id)))
        ).scalar() or 0

        print("\n" + "=" * 50)
        print("[OK] INGESTION SUMMARY:")
        print("=" * 50)
        print(f"* Newly Inserted: {inserted} sections")
        print(f"* Skipped (Already Present): {skipped} sections")
        print(f"* Total Bare Act Sections in Supabase: {total_in_db}")

        if act_counts:
            print("\nBreakdown by Sanhita:")
            for act, count in act_counts.items():
                print(f"  - {act}: +{count} sections")
        print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="Ingest Bare Acts into Supabase DB")
    parser.add_argument(
        "--file",
        type=str,
        default=None,
        help="Path to JSON file containing sections (defaults to backend/data/section_mappings.json)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear existing section mappings before inserting",
    )
    args = parser.parse_args()

    asyncio.run(ingest_bare_acts(file_path=args.file, reset=args.reset))


if __name__ == "__main__":
    main()
