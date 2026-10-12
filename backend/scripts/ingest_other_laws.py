import asyncio
import json
import os
import re
import sys
import httpx
import pandas as pd

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.src.core.database import async_session, init_db
from backend.src.models.other_law import OtherLawStatute
from sqlalchemy import select, func, delete

HF_PARQUET_URL = "https://huggingface.co/datasets/mratanusarkar/Indian-Laws/resolve/main/data/indian_law_bare_acts_dataset.parquet"
CIVICTECH_BASE = "https://raw.githubusercontent.com/civictech-India/Indian-Law-Penal-Code-Json/main"


def clean_text(val) -> str:
    if not val:
        return ""
    cleaned = str(val).replace("\r\n", " ").replace("\n", " ").replace("\ufffd", "").strip()
    return re.sub(r"\s+", " ", cleaned)


def extract_section_title_and_text(act_name: str, sec_num: str, raw_law: str) -> tuple:
    raw_law = str(raw_law).replace("\ufffd", "").strip()
    lines = [l.strip() for l in raw_law.split("\n") if l.strip()]
    if not lines:
        sec = f"Section {sec_num}" if sec_num and not str(sec_num).lower().startswith("sec") else str(sec_num)
        return (sec, f"{act_name} {sec}", "")

    start_idx = 0
    while start_idx < len(lines) and (
        act_name.lower() in lines[start_idx].lower()
        or lines[start_idx].lower().startswith("chapter")
        or lines[start_idx].lower().startswith("part ")
        or lines[start_idx].lower() in ["preliminary", "schedule"]
    ):
        start_idx += 1

    remaining_text = "\n".join(lines[start_idx:]).strip()

    # Match section pattern: "31. Title here.- description..." or "31. Title here - description..."
    m = re.search(
        r"^\s*(\d+[A-Za-z]*)[\.\s\-:]+(.*?)(?:(?:\.\s*[\-\u2013\u2014])|(?:\s*[\-\u2013\u2014]\s*)|\.\s*\n)(.*)",
        remaining_text,
        re.DOTALL,
    )
    if m:
        title = re.sub(r"\s+", " ", m.group(2)).strip().rstrip(".-:")
        body = clean_text(m.group(3))
        sec = f"Section {m.group(1)}"
        return (sec, title or f"{act_name} {sec}", body if len(body) > 10 else clean_text(remaining_text))

    if start_idx < len(lines):
        first_line = lines[start_idx]
        m2 = re.match(r"^\s*(\d+[A-Za-z]*)[\.\s\-:]+(.*)", first_line)
        if m2:
            sec = f"Section {m2.group(1)}"
            title = m2.group(2).strip().rstrip(".-:")
            body = clean_text("\n".join(lines[start_idx + 1 :]))
            return (sec, title or f"{act_name} {sec}", body if len(body) > 10 else clean_text(remaining_text))

    sec = f"Section {sec_num}" if sec_num and not str(sec_num).lower().startswith("sec") else str(sec_num)
    title = f"{act_name} {sec}"
    body = clean_text(remaining_text)
    return (sec, title, body)


async def fetch_civictech_acts() -> list:
    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. CPC (Civil Law)
        print("  -> Fetching Code of Civil Procedure (cpc.json)...")
        try:
            r = await client.get(f"{CIVICTECH_BASE}/cpc.json")
            if r.status_code == 200:
                for item in r.json():
                    sec_val = item.get("section")
                    results.append({
                        "category": "Civil Law",
                        "subcategory": "Civil Procedure",
                        "act_name": "Code of Civil Procedure, 1908",
                        "section": f"Section {sec_val}",
                        "title": clean_text(item.get("title", "")),
                        "description": clean_text(item.get("description", "")),
                    })
        except Exception as e:
            print(f"    [WARN] Failed to fetch cpc.json: {e}")

        # 2. Negotiable Instruments Act (Commercial Law)
        print("  -> Fetching Negotiable Instruments Act (nia.json)...")
        try:
            r = await client.get(f"{CIVICTECH_BASE}/nia.json")
            if r.status_code == 200:
                for item in r.json():
                    sec_val = item.get("section")
                    results.append({
                        "category": "Commercial Law",
                        "subcategory": "Negotiable Instruments / Banking",
                        "act_name": "Negotiable Instruments Act, 1881",
                        "section": f"Section {sec_val}",
                        "title": clean_text(item.get("section_title", "")),
                        "description": clean_text(item.get("section_desc", "")),
                    })
        except Exception as e:
            print(f"    [WARN] Failed to fetch nia.json: {e}")

        # 3. Indian Divorce Act (Family Law)
        print("  -> Fetching Indian Divorce Act (ida.json)...")
        try:
            r = await client.get(f"{CIVICTECH_BASE}/ida.json")
            if r.status_code == 200:
                for item in r.json():
                    sec_val = item.get("section")
                    results.append({
                        "category": "Family Law",
                        "subcategory": "Divorce",
                        "act_name": "Indian Divorce Act, 1869",
                        "section": f"Section {sec_val}",
                        "title": clean_text(item.get("title", "")),
                        "description": clean_text(item.get("description", "")),
                    })
        except Exception as e:
            print(f"    [WARN] Failed to fetch ida.json: {e}")

    return results


def get_curated_specialized_laws() -> list:
    """Specialized core provisions for modern DPDP, POSH, State Police, Land, and Law of Torts."""
    return [
        # --- Cyber Law: Digital Personal Data Protection Act, 2023 ---
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 4",
            "title": "Grounds for processing personal data",
            "description": "A person may process the personal data of an individual only in accordance with the provisions of this Act and for a lawful purpose for which the Data Principal has given her consent; or for certain legitimate uses as specified in Section 7."
        },
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 5",
            "title": "Notice requirement before seeking consent",
            "description": "Every request for consent shall be preceded or accompanied by a notice informing the Data Principal of the personal data to be collected, the purpose of processing, the manner of exercising rights under section 11 and 12, and how to file a complaint with the Data Protection Board."
        },
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 6",
            "title": "Consent requirements and withdrawal",
            "description": "Consent of the Data Principal shall be free, specific, informed, unconditional, unambiguous with a clear affirmative action. The Data Principal shall have the right to withdraw consent at any time with comparable ease."
        },
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 8",
            "title": "General obligations of Data Fiduciaries",
            "description": "Data Fiduciaries must implement appropriate technical and organizational measures to ensure compliance, protect personal data in its possession by taking reasonable security safeguards, and intimate the Board and affected users in event of a data breach."
        },
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 11",
            "title": "Right to access information about personal data",
            "description": "The Data Principal shall have the right to obtain from the Data Fiduciary a summary of personal data being processed, identity of all other Data Fiduciaries and Data Processors with whom the personal data has been shared, and other relevant details."
        },
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 12",
            "title": "Right to correction and erasure of personal data",
            "description": "A Data Principal shall have the right to correction, completion, updating and erasure of her personal data for the processing of which she has previously given consent in accordance with the prescribed procedure."
        },
        {
            "category": "Cyber Law", "subcategory": "Digital / Privacy",
            "act_name": "Digital Personal Data Protection Act, 2023", "section": "Section 33",
            "title": "Financial penalties for breach of data security",
            "description": "If the Board determines non-compliance, it may impose significant financial penalties: up to 250 crore rupees for failure to take reasonable security safeguards to prevent personal data breach under section 8(5), and up to 200 crore rupees for failure to notify a personal data breach."
        },

        # --- Civil Law: Law of Torts Landmark Doctrines ---
        {
            "category": "Civil Law", "subcategory": "Torts",
            "act_name": "Law of Torts", "section": "Doctrine 1",
            "title": "Elements of Actionable Negligence",
            "description": "Actionable negligence consists in the neglect of the use of ordinary care or skill towards a person to whom the defendant owes the duty of observing ordinary care and skill, by which neglect the plaintiff has suffered injury to his person or property. Key requirements: (1) Existence of a legal duty to take care (Donoghue v Stevenson), (2) Breach of said legal duty, (3) Consequential damage to the claimant."
        },
        {
            "category": "Civil Law", "subcategory": "Torts",
            "act_name": "Law of Torts", "section": "Doctrine 2",
            "title": "Rule of Strict and Absolute Liability",
            "description": "Under Rylands v Fletcher, a person who for his own purposes brings on his land anything likely to do mischief if it escapes, must keep it in at his peril. In India, the Supreme Court in M.C. Mehta v Union of India established the Principle of Absolute Liability: an enterprise engaged in a hazardous or inherently dangerous activity owes an absolute and non-delegable duty to the community without any exceptions."
        },
        {
            "category": "Civil Law", "subcategory": "Torts",
            "act_name": "Law of Torts", "section": "Doctrine 3",
            "title": "Vicarious Liability in Employment",
            "description": "A master is vicariously liable for any tort committed by his servant in the course of his employment. Even if the unauthorized act is an improper mode of doing an authorized act, the employer remains liable under the doctrine of Qui facit per alium facit per se."
        },
        {
            "category": "Civil Law", "subcategory": "Torts",
            "act_name": "Law of Torts", "section": "Doctrine 4",
            "title": "Civil Defamation (Libel and Slander)",
            "description": "Defamation is the injury to the reputation of a person. Defences available in civil tort: (1) Justification or Truth, (2) Fair comment on a matter of public interest, (3) Absolute and Qualified privilege."
        },
        {
            "category": "Civil Law", "subcategory": "Torts",
            "act_name": "Law of Torts", "section": "Doctrine 5",
            "title": "Nuisance and Injunctive Remedies",
            "description": "Nuisance is unlawful interference with a person's use or enjoyment of land, or of some right over, or in connection with it. Remedies include abatement of nuisance, damages for injury suffered, and perpetual or temporary injunction under the Specific Relief Act."
        },

        # --- Labour Law: POSH Act, 2013 ---
        {
            "category": "Labour Law", "subcategory": "POSH & Workplace Equality",
            "act_name": "Sexual Harassment of Women at Workplace (POSH) Act, 2013", "section": "Section 4",
            "title": "Constitution of Internal Complaints Committee (ICC)",
            "description": "Every employer of a workplace employing ten or more workers shall constitute an Internal Complaints Committee by an order in writing. The Presiding Officer shall be a woman employed at a senior level, with not less than two employee members committed to women's causes, and one external member from an NGO."
        },
        {
            "category": "Labour Law", "subcategory": "POSH & Workplace Equality",
            "act_name": "Sexual Harassment of Women at Workplace (POSH) Act, 2013", "section": "Section 9",
            "title": "Complaint of sexual harassment",
            "description": "Any aggrieved woman may make, in writing, a complaint of sexual harassment at workplace to the Internal Committee or Local Committee within a period of three months from the date of incident, extendable by further three months if circumstances prevented filing."
        },
        {
            "category": "Labour Law", "subcategory": "POSH & Workplace Equality",
            "act_name": "Sexual Harassment of Women at Workplace (POSH) Act, 2013", "section": "Section 11",
            "title": "Inquiry into complaint",
            "description": "The Internal Committee shall proceed to make inquiry into the complaint in accordance with the provisions of the service rules applicable to the respondent, having powers equivalent to a Civil Court under CPC for summoning and discovery."
        },
        {
            "category": "Labour Law", "subcategory": "POSH & Workplace Equality",
            "act_name": "Sexual Harassment of Women at Workplace (POSH) Act, 2013", "section": "Section 26",
            "title": "Penalties for non-compliance by employer",
            "description": "Failure of an employer to constitute an Internal Committee, failure to act on recommendations, or contravention of provisions is punishable with fine up to fifty thousand rupees, and repeated conviction may lead to cancellation of business license or registration."
        },

        # --- State Laws: Maharashtra Police Act, MCOCA, Land Revenue, MOFA ---
        {
            "category": "State Laws", "subcategory": "Maharashtra Police",
            "act_name": "Maharashtra Police Act, 1951", "section": "Section 33",
            "title": "Power to make rules for traffic regulation and order",
            "description": "The Commissioner and the District Magistrate may make, alter or rescind rules for licensing, controlling, and regulating vehicles, public processions, loudspeakers, music, and public places to maintain order and traffic safety."
        },
        {
            "category": "State Laws", "subcategory": "Maharashtra Police",
            "act_name": "Maharashtra Police Act, 1951", "section": "Section 56",
            "title": "Removal of persons about to commit offences (Externment)",
            "description": "Whenever it causes or is calculated to cause danger, alarm or harm to person or property, or there are reasonable grounds for believing that such person is engaged or about to engage in offences, the competent officer may direct such person to remove himself outside the specified area for a period not exceeding two years."
        },
        {
            "category": "State Laws", "subcategory": "Maharashtra Police",
            "act_name": "Maharashtra Police Act, 1951", "section": "Section 57",
            "title": "Removal of convicted habitual offenders",
            "description": "Empowers externment of persons convicted of offences under Chapter XII, XVI, or XVII of IPC/BNS, Prohibition Act, or dangerous activities if there is reason to believe they are likely to repeat such offences."
        },
        {
            "category": "State Laws", "subcategory": "MCOCA",
            "act_name": "Maharashtra Control of Organised Crime Act (MCOCA), 1999", "section": "Section 2(1)(d)",
            "title": "Continuing Unlawful Activity definition",
            "description": "An activity prohibited by law, which is a cognizable offence punishable with imprisonment of three years or more, undertaken either singly or jointly, as a member of an organised crime syndicate, in respect of which more than one charge-sheet have been filed before a competent court within the preceding ten years."
        },
        {
            "category": "State Laws", "subcategory": "MCOCA",
            "act_name": "Maharashtra Control of Organised Crime Act (MCOCA), 1999", "section": "Section 3",
            "title": "Punishment for organised crime",
            "description": "Whoever commits an offence of organised crime shall, if such offence results in death of any person, be punishable with death or imprisonment for life and fine not less than one lakh rupees; in other cases imprisonment for not less than five years."
        },
        {
            "category": "State Laws", "subcategory": "MCOCA",
            "act_name": "Maharashtra Control of Organised Crime Act (MCOCA), 1999", "section": "Section 18",
            "title": "Admissibility of confessions made to police officer",
            "description": "Notwithstanding anything contained in the Code or Evidence Act, a confession made by a person before a police officer not below the rank of Superintendent of Police and recorded in writing or on mechanical devices shall be admissible in trial of such person or co-accused."
        },
        {
            "category": "State Laws", "subcategory": "MCOCA",
            "act_name": "Maharashtra Control of Organised Crime Act (MCOCA), 1999", "section": "Section 21",
            "title": "Modified application of procedural code and strict bail",
            "description": "No person accused of an offence punishable under MCOCA shall be released on bail unless the Public Prosecutor has been given an opportunity to oppose and the Court is satisfied that there are reasonable grounds for believing that he is not guilty and not likely to commit any offence while on bail."
        },
        {
            "category": "State Laws", "subcategory": "Land Revenue",
            "act_name": "Maharashtra Land Revenue Code, 1966", "section": "Section 42",
            "title": "Permission for non-agricultural (NA) use of land",
            "description": "No person shall use any land assessed or held for the purpose of agriculture for any non-agricultural purpose without the prior written permission of the Collector obtained under the prescribed application process."
        },
        {
            "category": "State Laws", "subcategory": "Land Revenue",
            "act_name": "Maharashtra Land Revenue Code, 1966", "section": "Section 148",
            "title": "Record of Rights (7/12 Extract)",
            "description": "A record of rights shall be maintained in every village and shall include names of all persons who are holders, occupants, owners, mortgagees of the land, nature and extent of respective interests, and rent or revenue payable."
        },
        {
            "category": "State Laws", "subcategory": "MOFA / Housing",
            "act_name": "Maharashtra Ownership Flats Act (MOFA), 1963", "section": "Section 4",
            "title": "Promoter before accepting advance to enter into agreement",
            "description": "A promoter shall not accept any sum of money as advance payment or deposit exceeding twenty percent of the sale price without entering into a written agreement for sale registered under the Registration Act, 1908."
        },
        {
            "category": "State Laws", "subcategory": "MOFA / Housing",
            "act_name": "Maharashtra Ownership Flats Act (MOFA), 1963", "section": "Section 11",
            "title": "Promoter's duty to convey title (Deemed Conveyance)",
            "description": "A promoter shall take all necessary steps to complete his title and convey to the cooperative society or company of flat purchasers his right, title and interest in the land and building within four months from date of registration of society. Provides for unilateral deemed conveyance if builder fails."
        },
    ]


async def download_and_compile_other_laws():
    print("=" * 65)
    print(">>> [1/4] Downloading Hugging Face & CivicTech Indian Law Datasets <<<")
    print("=" * 65)

    all_statutes = []
    seen_keys = set()

    # 1. Fetch CivicTech JSON acts (CPC, NIA, IDA)
    civictech_items = await fetch_civictech_acts()
    for item in civictech_items:
        key = (item["category"], item["act_name"], item["section"])
        if key not in seen_keys:
            seen_keys.add(key)
            all_statutes.append(item)
    print(f"[OK] Parsed {len(civictech_items)} statutory sections from CivicTech India.")

    # 2. Add Curated specialized laws
    curated_items = get_curated_specialized_laws()
    for item in curated_items:
        key = (item["category"], item["act_name"], item["section"])
        if key not in seen_keys:
            seen_keys.add(key)
            all_statutes.append(item)
    print(f"[OK] Appended {len(curated_items)} specialized statutory provisions (DPDP, POSH, MCOCA, Torts, etc.).")

    # 3. Download & Parse Hugging Face Parquet dataset
    print("\n  -> Fetching Hugging Face parquet dataset (mratanusarkar/Indian-Laws)...")
    df = pd.read_parquet(HF_PARQUET_URL)
    print(f"[OK] Loaded parquet dataset with {len(df)} total Indian statute rows.")

    # Mapping target acts from Parquet to Categories & Subcategories
    parquet_act_map = {
        # Civil Law
        "Indian Contract Act, 1872": ("Civil Law", "Contracts"),
        "Transfer of Property Act, 1882": ("Civil Law", "Property"),
        "Specific Relief Act, 1963": ("Civil Law", "Specific Relief"),
        "Limitation Act, 1963": ("Civil Law", "Limitation"),

        # Family Law
        "Hindu Marriage Act, 1955": ("Family Law", "Marriage"),
        "Special Marriage Act, 1954": ("Family Law", "Marriage"),
        "Hindu Succession Act, 1956": ("Family Law", "Succession"),
        "Hindu Adoptions and Maintenance Act, 1956": ("Family Law", "Adoption & Maintenance"),
        "Protection of Women from Domestic Violence Act, 2005": ("Family Law", "Domestic Violence"),

        # Commercial Law
        "Consumer Protection Act, 2019": ("Commercial Law", "Consumer Protection"),
        "Arbitration and Conciliation Act, 1996": ("Commercial Law", "Arbitration"),
        "Sale of Goods Act, 1930": ("Commercial Law", "Sale of Goods"),
        "Companies Act, 2013": ("Commercial Law", "Companies"),
        "Insolvency and Bankruptcy Code Act, 2016": ("Commercial Law", "IBC"),
        "Competition Act, 2002": ("Commercial Law", "Competition"),
        "Securitisation and Reconstruction of Financial Assets and Enforcement of Security Interest Act, 2002": ("Commercial Law", "Banking / SARFAESI"),
        "Banking Regulation Act, 1949": ("Commercial Law", "Banking"),

        # Cyber Law
        "Information Technology Act, 2000": ("Cyber Law", "IT Act & Cyber Crimes"),

        # Labour Law
        "Industrial Disputes Act, 1947": ("Labour Law", "Disputes & Strikes"),
        "Factories Act, 1948": ("Labour Law", "Workplace Safety"),
        "Payment of Gratuity Act, 1972": ("Labour Law", "Gratuity"),
        "Maternity Benefit Act, 1961": ("Labour Law", "Maternity & Women Welfare"),
        "Payment of Wages Act, 1936": ("Labour Law", "Wages"),
        "Minimum Wages Act, 1948": ("Labour Law", "Minimum Wages"),

        # State Laws
        "Maharashtra Rent Control Act, 1999": ("State Laws", "Rent Control"),
        "Real Estate (Regulation and Development) Act, 2016": ("State Laws", "Real Estate / RERA"),
        "Motor Vehicles Act, 1988": ("State Laws", "Traffic & Vehicles"),

        # Tax Law
        "Income-Tax Act, 1961": ("Tax Law", "Income Tax"),
        "Central Goods and Services Tax Act, 2017": ("Tax Law", "GST"),
        "Integrated Goods and Services Tax Act, 2017": ("Tax Law", "IGST"),
        "Black Money (Undisclosed Foreign Income and Assets) and Imposition of Tax Act, 2015": ("Tax Law", "Corporate & Anti-Evasion Tax"),

        # Food Law
        "Food Safety and Standards Act, 2006": ("Food Law", "FSSAI Act"),
    }

    print("\n>>> [2/4] Normalizing and parsing sections across all 8 categories...")
    for act_name, (cat, subcat) in parquet_act_map.items():
        sub_df = df[df["act_title"] == act_name]
        count_for_act = 0
        for _, row in sub_df.iterrows():
            raw_sec = str(row["section"]).strip()
            sec, title, body = extract_section_title_and_text(act_name, raw_sec, row["law"])

            if not body or len(body) < 15:
                continue

            key = (cat, act_name, sec)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            all_statutes.append({
                "category": cat,
                "subcategory": subcat,
                "act_name": act_name,
                "section": sec,
                "title": title[:450],
                "description": body,
            })
            count_for_act += 1

        print(f"  + [{cat}] {act_name}: {count_for_act} sections added")

    print(f"\n[OK] Total compiled statutory sections: {len(all_statutes)}")

    # Natural sort order key
    def natural_sort_key_statute(item):
        cat_order = {
            "Civil Law": 1, "Family Law": 2, "Commercial Law": 3, "Cyber Law": 4,
            "Labour Law": 5, "State Laws": 6, "Tax Law": 7, "Food Law": 8
        }
        cat_rank = cat_order.get(item["category"], 9)
        sec_str = item["section"]
        m = re.search(r"\d+", sec_str)
        num = int(m.group()) if m else 999999
        return (cat_rank, item["act_name"], num, sec_str)

    all_statutes.sort(key=natural_sort_key_statute)

    # Save to local persistent file: backend/data/other_law_statutes.json
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "other_law_statutes.json",
    )
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(all_statutes, f, indent=2, ensure_ascii=False)
    print(f"[OK] Saved comprehensive dataset to: {data_path} ({len(all_statutes)} sections)")

    # 4. Ingest into Supabase PostgreSQL
    print("\n>>> [3/4] Ingesting into Supabase PostgreSQL (other_law_statutes table)...")
    await init_db()

    async with async_session() as session:
        print("[INFO] Clearing existing stub records in other_law_statutes...")
        await session.execute(delete(OtherLawStatute))
        await session.commit()

        batch_size = 100
        total = len(all_statutes)
        inserted = 0

        for idx in range(0, total, batch_size):
            batch = all_statutes[idx : idx + batch_size]
            for item in batch:
                statute = OtherLawStatute(
                    category=item["category"],
                    subcategory=item["subcategory"],
                    act_name=item["act_name"],
                    section=item["section"],
                    title=item["title"],
                    description=item["description"],
                )
                session.add(statute)
                inserted += 1
            await session.commit()
            print(f"  -> Uploaded {inserted}/{total} sections to Supabase...")

        total_in_db = (
            await session.execute(select(func.count(OtherLawStatute.id)))
        ).scalar() or 0

    print("\n" + "=" * 65)
    print(">>> [4/4] COMPLETE OTHER LAWS INGESTION FINISHED! <<<")
    print("=" * 65)
    print(f"Total sections saved in Supabase other_law_statutes: {total_in_db}")

    # Category breakdown
    cat_counts = {}
    for s in all_statutes:
        cat = s["category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    print("\nBreakdown by Category:")
    for cat, cnt in sorted(cat_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  * {cat}: {cnt} sections")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(download_and_compile_other_laws())
