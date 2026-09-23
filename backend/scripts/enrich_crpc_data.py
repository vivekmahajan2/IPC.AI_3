import json
import re
import sys
import httpx
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Contextual procedural chapter overviews for CrPC sections
CHAPTER_THEMES = [
    (1, 5, "Preliminary", "governing the territorial application, statutory definitions, and foundational jurisdiction of criminal courts"),
    (6, 25, "Constitution of Criminal Courts", "establishing the hierarchy, territorial divisions, and judicial powers of criminal courts and public prosecutors"),
    (26, 35, "Powers of Courts", "defining the jurisdiction of magistrates and sessions judges to try offences and pass statutory sentences"),
    (36, 40, "Powers of Superior Police & Public Aid", "mandating public assistance to police officers and magistrates in preventing escapes and suppressing crime"),
    (41, 60, "Arrest of Persons", "regulating police powers of arrest, statutory safeguards against arbitrary detention, and medical examination of arrestees"),
    (61, 90, "Processes to Compel Appearance", "outlining the procedure for issuing summons, warrants of arrest, and proclamations against absconding offenders"),
    (91, 105, "Processes to Compel Production of Things", "empowering courts and police officers to issue search warrants, seize material evidence, and inspect premises"),
    (106, 124, "Security Proceedings", "prescribing preventive bonds and sureties to maintain public peace and good behaviour"),
    (125, 128, "Maintenance of Wives, Children and Parents", "providing statutory remedies for maintenance to prevent vagrancy and destitution"),
    (129, 148, "Public Order and Tranquillity", "governing the dispersal of unlawful assemblies, removal of public nuisances, and urgent injunctions"),
    (149, 153, "Preventive Police Action", "authorizing police officers to take preventive measures to avert cognizable offences and protect public property"),
    (154, 176, "Police Investigation and Inquest", "regulating the recording of FIRs, examination of witnesses, judicial confessions, remand custody, and police reports"),
    (177, 189, "Jurisdiction in Inquiries and Trials", "specifying territorial jurisdiction and the appropriate forum for trying criminal offences"),
    (190, 199, "Cognizance of Offences", "defining conditions for magistrates to take judicial cognizance and require previous statutory sanction"),
    (200, 203, "Complaints to Magistrates", "prescribing the examination of complainants and inquiry procedures before issuing process"),
    (204, 210, "Commencement of Proceedings", "regulating the issuance of summons or warrants and supply of police report copies to the accused"),
    (211, 224, "The Charge", "mandating the form, particulars, and joinder of formal charges to ensure fair trial notice for the accused"),
    (225, 237, "Sessions Trial", "prescribing the full procedure for trials before the Court of Session conducted by the Public Prosecutor"),
    (238, 250, "Warrant Cases by Magistrates", "governing magistrate trials of warrant cases instituted on police reports or private complaints"),
    (251, 259, "Summons Cases by Magistrates", "regulating the streamlined procedure for trying summons cases without formal charge framing"),
    (260, 265, "Summary Trials", "enabling expedited trials for specified petty offences punishable with short terms of imprisonment"),
    (266, 271, "Attendance of Detained Persons", "facilitating the examination and court appearance of persons confined in prison"),
    (272, 299, "Evidence in Inquiries and Trials", "governing the recording of oral evidence, cross-examination, and judicial commissions"),
    (300, 327, "General Provisions for Inquiries and Trials", "safeguarding constitutional rights against double jeopardy, right to legal aid, and compounding of offences"),
    (328, 339, "Accused Persons of Unsound Mind", "prescribing procedures for inquiry, custody, and trial of mentally incapable accused persons"),
    (340, 352, "Offences Affecting Administration of Justice", "regulating prosecution for perjury, fabrication of false evidence, and contempt of lawful authority"),
    (353, 365, "The Judgment", "specifying the contents, pronouncement, and victim compensation orders accompanying criminal judgments"),
    (366, 371, "Confirmation of Death Sentences", "mandating compulsory High Court confirmation and bench scrutiny for capital punishment cases"),
    (372, 394, "Appeals", "governing the statutory right of appeal against convictions, acquittals, and sentence inadequacy"),
    (395, 405, "Reference and Revision", "empowering superior courts to examine the correctness, legality, or propriety of judicial findings"),
    (406, 412, "Transfer of Criminal Cases", "authorizing the Supreme Court, High Court, and Sessions Court to transfer cases to secure the ends of justice"),
    (413, 435, "Execution, Suspension and Remission", "regulating the execution of sentences, warrants of commitment, and state powers of remission"),
    (436, 450, "Bail and Bonds", "governing bail in bailable cases, discretionary bail in non-bailable cases, anticipatory bail, and sureties"),
    (451, 459, "Disposal of Property", "regulating custody, return, auction, and confiscation of property produced or seized during trial"),
    (460, 466, "Irregular Proceedings", "distinguishing between curable procedural irregularities and incurable defects that vitiate trials"),
    (467, 473, "Limitation for Taking Cognizance", "establishing statutory limitation periods barring belated criminal prosecution"),
    (474, 484, "Miscellaneous", "preserving the inherent powers of High Courts under Section 482 and transitional repeal provisions")
]

def get_chapter_info(sec_num_int: int):
    for start, end, name, desc in CHAPTER_THEMES:
        if start <= sec_num_int <= end:
            return name, desc
    return "Criminal Procedure", "regulating the statutory machinery for investigation, trial, and enforcement of criminal justice"

DEFINITIONS_MAP = {
    "a": "Under Section 2(a) of the Code of Criminal Procedure, 1973, 'bailable offence' means an offence shown as bailable in the First Schedule or made bailable under any other prevailing law, while 'non-bailable offence' denotes any other crime. In bailable offences, the accused enjoys an unconditional statutory right to be released on bail by the arresting officer or magistrate upon furnishing bail bonds. Conversely, in non-bailable offences, the grant of bail is not a matter of right but lies within judicial discretion under Section 437.",
    "b": "Under Section 2(b) of the Code of Criminal Procedure, 1973, 'charge' includes any head of charge when the accusation contains more heads than one. It forms the formal statutory basis of a criminal trial, informing the accused of the precise legal allegations, time, and manner of the offence. The accurate formulation of charges safeguards the constitutional guarantee of a fair trial and prevents prejudice during the defense.",
    "c": "Under Section 2(c) of the Code of Criminal Procedure, 1973, 'cognizable offence' denotes an offence for which a police officer may arrest the accused without a warrant from a magistrate in accordance with the First Schedule. It empowers law enforcement officers to mandatorily register an FIR under Section 154 and immediately initiate investigation without prior magisterial permission. Such offences generally represent grave or public crimes requiring urgent police intervention.",
    "d": "Under Section 2(d) of the Code of Criminal Procedure, 1973, 'complaint' means any allegation made orally or in writing to a magistrate, with a view to taking judicial action, that some person has committed an offence. It explicitly excludes a police report submitted after formal investigation, though a report disclosing a non-cognizable offence is deemed a complaint. It enables private citizens to directly invoke judicial scrutiny when police fail to act.",
    "e": "Under Section 2(e) of the Code of Criminal Procedure, 1973, 'High Court' refers to the highest court of criminal appeal and revision for each State or Union Territory. It exercises constitutional and statutory supervisory jurisdiction over all subordinate criminal courts and magistrates within its territorial limits. The High Court holds inherent powers under Section 482 to prevent abuse of the judicial process.",
    "f": "Under Section 2(f) of the Code of Criminal Procedure, 1973, 'India' means the territories to which this Code extends, defining the spatial boundaries of national criminal procedural jurisdiction. It establishes uniform procedural administration across states while preserving local customary exceptions in tribal areas.",
    "g": "Under Section 2(g) of the Code of Criminal Procedure, 1973, 'inquiry' means every inquiry, other than a trial, conducted under this Code by a magistrate or court. It represents the judicial stage preceding trial where the magistrate determines whether sufficient grounds exist to proceed against the accused. It forms a distinct procedural phase separating police investigation from formal judicial adjudication.",
    "h": "Under Section 2(h) of the Code of Criminal Procedure, 1973, 'investigation' includes all proceedings conducted by a police officer or authorized person (other than a magistrate) for the collection of evidence. It commences upon receipt of information disclosing a cognizable crime and encompasses visiting the crime scene, interrogating witnesses, seizing evidence, and arresting suspects. The investigation culminates in the submission of a police report under Section 173.",
    "i": "Under Section 2(i) of the Code of Criminal Procedure, 1973, 'judicial proceeding' includes any proceeding in the course of which evidence is or may be legally taken on oath. It subjects participating parties and witnesses to statutory penalties for perjury and false evidence under criminal law. This formal character distinguishes court examinations from routine administrative or executive inquiries.",
    "j": "Under Section 2(j) of the Code of Criminal Procedure, 1973, 'local jurisdiction' defines the geographical area within which a court or magistrate may legally exercise all or any of its powers. It determines the proper territorial venue for initiating inquiries, issuing process, and conducting trials based on where the offence occurred. Territorial limits are specified by the State Government or High Court.",
    "k": "Under Section 2(k) of the Code of Criminal Procedure, 1973, 'metropolitan area' denotes any city or town declared as such having a population exceeding one million persons. In such areas, criminal administration is presided over by Metropolitan Magistrates rather than Judicial Magistrates. The Presidency towns of Bombay, Calcutta, and Madras and the city of Ahmedabad were declared metropolitan areas from the Code's inception.",
    "l": "Under Section 2(l) of the Code of Criminal Procedure, 1973, 'non-cognizable offence' denotes an offence for which a police officer has no authority to arrest without a warrant. In non-cognizable cases, police officers cannot initiate investigation or register an FIR without obtaining an express order from the jurisdictional magistrate under Section 155. This requirement protects citizens from intrusive police action in petty disputes.",
    "m": "Under Section 2(m) of the Code of Criminal Procedure, 1973, 'notification' means a notification published in the Official Gazette of the Central or State Government. It provides the statutory mechanism for promulgating executive rules, territorial divisions, and dates of legal enforcement. Official publication establishes constructive notice binding upon the public and law enforcement.",
    "n": "Under Section 2(n) of the Code of Criminal Procedure, 1973, 'offence' means any act or omission made punishable by any law for the time being in force, including any act in respect of which a complaint may be made under Section 20 of the Cattle-trespass Act. It defines the core subject-matter of criminal proceedings that justifies arrest, charge, and penal trial. An act must be formally designated as punishable by legislature to constitute an offence.",
    "o": "Under Section 2(o) of the Code of Criminal Procedure, 1973, 'officer in charge of a police station' includes any police officer present at the station who is next in rank to the in-charge officer and above the rank of constable. It ensures that statutory investigative and supervisory functions never lapse during the absence or illness of the primary station house officer. Such officers possess vital statutory powers under Sections 154, 156, and 157.",
    "p": "Under Section 2(p) of the Code of Criminal Procedure, 1973, 'place' includes a house, building, tent, vehicle, and vessel, defining the physical scope of search, inspection, and crime scenes. This broad statutory definition enables police officers to conduct lawful searches across movable and immovable property during investigation. It prevents offenders from evading search procedures by utilizing transient or vehicular structures.",
    "q": "Under Section 2(q) of the Code of Criminal Procedure, 1973, 'pleader' means a person authorized by or under any law to practice in a court, including an advocate, attorney, or any other person appointed with court permission. It secures the constitutional and statutory right of the accused to be represented by qualified legal counsel throughout criminal proceedings. Legal representation ensures procedural equality between the state prosecution and the defense.",
    "r": "Under Section 2(r) of the Code of Criminal Procedure, 1973, 'police report' means a report forwarded by a police officer to a magistrate under sub-section (2) of Section 173. It constitutes the final chargesheet or closure report filed upon completion of criminal investigation. The magistrate examines this statutory report to decide whether to take cognizance of the offence.",
    "s": "Under Section 2(s) of the Code of Criminal Procedure, 1973, 'police station' means any post or place declared generally or specially by the State Government to be a police station, including any local area specified in that behalf. It serves as the primary administrative unit for recording FIRs, housing custody, and deploying field investigation. Its territorial jurisdiction dictates the venue for investigating local criminal occurrences.",
    "t": "Under Section 2(t) of the Code of Criminal Procedure, 1973, 'prescribed' means prescribed by rules made under this Code by the High Court or State Government. It establishes the subordinate legislative framework governing forms, court registers, and procedural guidelines. Prescribed statutory forms ensure institutional consistency across criminal courts nationwide.",
    "u": "Under Section 2(u) of the Code of Criminal Procedure, 1973, 'Public Prosecutor' means any person appointed under Section 24 and includes any person acting under the direction of a Public Prosecutor. The Public Prosecutor represents the State in criminal trials to assist the court in discovering the truth rather than seeking a conviction at all costs. They conduct sessions trials and hold statutory power regarding withdrawal from prosecution.",
    "v": "Under Section 2(v) of the Code of Criminal Procedure, 1973, 'sub-division' means a sub-division of a district, creating administrative units within sessions divisions for localized magisterial supervision. Sub-divisional magistrates oversee preventive proceedings and maintenance of public order within their assigned sub-division.",
    "w": "Under Section 2(w) of the Code of Criminal Procedure, 1973, 'summons-case' means a case relating to an offence, not being a warrant-case, generally punishable with imprisonment for a term not exceeding two years. It is tried under the simplified procedure in Chapter XX without the formal requirement of framing written charges. This distinction expedites the judicial disposal of comparatively minor criminal charges.",
    "wa": "Under Section 2(wa) of the Code of Criminal Procedure, 1973, 'victim' means a person who has suffered any loss or injury caused by reason of the act or omission for which the accused person has been charged, including their guardian or legal heir. Inserted by the 2008 amendment, this provision transformed Indian criminal jurisprudence by granting statutory standing, compensation rights, and appeal rights to victims.",
    "x": "Under Section 2(x) of the Code of Criminal Procedure, 1973, 'warrant-case' means a case relating to an offence punishable with death, imprisonment for life, or imprisonment for a term exceeding two years. It mandates the detailed trial procedure under Chapter XIX involving discharge hearings, formal charge framing, and extensive defense cross-examination. These rigorous safeguards reflect the severe penal consequences of conviction."
}

def generate_crpc_description(sec: str, title: str, raw_text: str, mapping_notes: str) -> str:
    clean_title = title.strip("\"' \t\r\n")
    clean_sec = sec.strip(" \t\r\n")

    # Check for Section 2 definitions
    m_def = re.search(r"2\s*\(\s*([a-z]+)\s*\)", clean_sec, re.I)
    if m_def:
        letter = m_def.group(1).lower()
        if letter in DEFINITIONS_MAP:
            return DEFINITIONS_MAP[letter]

    # Specific key sections with tailored, high-precision procedural summaries
    if clean_sec == "1":
        return (
            "Section 1 defines the short title, territorial extent, and commencement of the Code of Criminal Procedure, 1973. "
            "It extends procedural jurisdiction across India to govern police investigations, inquiry mechanisms, and judicial trials. "
            "The Code came into force on April 1, 1974, providing uniform statutory safeguards while preserving specified customary procedures in tribal areas."
        )
    if clean_sec == "2":
        return (
            "Section 2 sets forth the authoritative statutory definitions governing criminal proceedings across the Code of Criminal Procedure, 1973. "
            "It establishes legal criteria distinguishing bailable from non-bailable offences, cognizable from non-cognizable crimes, and complaints from police chargesheets. "
            "These statutory definitions ensure uniform legal interpretation and procedural consistency across police stations and criminal courts nationwide."
        )
    if clean_sec == "41":
        return (
            "Section 41 empowers police officers to arrest individuals without a warrant or magisterial order under specified statutory conditions, including cognizable offences committed in their presence. "
            "For offences punishable with up to seven years' imprisonment, the officer must record reasons satisfying necessity benchmarks such as preventing evidence tampering or further crime. "
            "The section incorporates vital civil liberty safeguards and statutory oversight to curb arbitrary arrests."
        )
    if clean_sec == "154":
        return (
            "Section 154 mandates the compulsory registration of a First Information Report (FIR) whenever information disclosing the commission of a cognizable offence is provided to a police station. "
            "It requires oral statements to be reduced to writing, read over to the informant, signed, and furnished immediately to the complainant free of cost. "
            "This statutory provision sets the criminal justice machinery into motion and constitutes the foundational basis of subsequent police investigation."
        )
    if clean_sec == "161":
        return (
            "Section 161 authorizes investigating police officers to orally examine any person supposed to be acquainted with the facts and circumstances of the case. "
            "Witnesses are legally bound to answer truthfully all questions, excepting answers that would expose them to a criminal charge, penalty, or forfeiture. "
            "The investigating officer may reduce statements into writing, providing an essential factual record while protecting against self-incrimination."
        )
    if clean_sec == "164":
        return (
            "Section 164 empowers Metropolitan and Judicial Magistrates to record confessions and witness statements made during the course of a police investigation. "
            "The magistrate must warn the person that they are under no obligation to confess and verify that the confession is made voluntarily without police coercion. "
            "Confessions and statements recorded under this section carry substantial evidentiary value and judicial reliability in subsequent trial proceedings."
        )
    if clean_sec == "173":
        return (
            "Section 173 directs that every criminal investigation must be completed without unnecessary delay and concluded by submitting a final police report to the jurisdictional magistrate. "
            "This report (commonly termed a chargesheet or closure report) details the parties, nature of offences, witness lists, and whether the accused has been arrested or forwarded in custody. "
            "The magistrate examines this statutory report to decide whether to take judicial cognizance and proceed with the trial."
        )
    if clean_sec == "437":
        return (
            "Section 437 governs the discretionary powers and statutory limitations of magistrates and police officers regarding the grant of bail in non-bailable offences. "
            "It restricts bail if reasonable grounds exist showing the accused committed an offence punishable with death or life imprisonment, while providing exceptions for women, minors, and the sick. "
            "Courts are empowered to impose necessary conditions on bail to ensure witness protection and prevent interference with justice."
        )
    if clean_sec == "438":
        return (
            "Section 438 empowers the High Court and Court of Session to grant anticipatory bail to any person apprehending arrest on an accusation of a non-bailable offence. "
            "It acts as a constitutional shield against malicious arrests, motivated complaints, or political harassment initiated by influential adversaries. "
            "The court may impose binding conditions, including mandatory cooperation with police interrogations and restrictions on foreign travel."
        )
    if clean_sec == "482":
        return (
            "Section 482 preserves the inherent powers of the High Court to make such orders as may be necessary to give effect to any order under this Code, prevent abuse of the process of any court, or secure the ends of justice. "
            "It is frequently invoked to quash vexatious FIRs, frivolous complaints, and malicious criminal proceedings where no prima facie offence is disclosed. "
            "This extraordinary judicial remedy operates independently of express statutory provisions to prevent procedural injustice."
        )

    # Clean raw text from crpc.json if available
    cleaned_statutory = ""
    if raw_text:
        t = re.sub(r"[\x00-\x1f\x7f-\x9f\ufffd]", " ", raw_text)
        t = re.sub(r"\d+\.\s+(?:Subs\.|Ins\.|The words|Omitted|Added)\s+by\s+Act[^.]*\.", " ", t, flags=re.I)
        t = re.sub(r"STATE AMENDMENT.*", "", t, flags=re.DOTALL)
        t = re.sub(r"^\s*\d+\.?\s*[^.]*\.\s*", "", t)
        t = re.sub(r"\s+", " ", t).strip()

        # Split into sentences
        sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if len(s.strip()) > 25 and not s.strip().startswith(("1.", "2.", "3.", "4.", "5."))]
        # Filter sentences that look like footnote residue
        clean_sents = [s for s in sents if "w.e.f." not in s and "s. 1" not in s and "Act 1" not in s and "Act 2" not in s]
        if len(clean_sents) >= 2:
            cleaned_statutory = " ".join(clean_sents[:2]).strip()
            if not cleaned_statutory.endswith("."):
                cleaned_statutory += "."

    # Parse section number for chapter theme
    m_num = re.match(r"^(\d+)", clean_sec)
    sec_num_int = int(m_num.group(1)) if m_num else 1
    ch_name, ch_desc = get_chapter_info(sec_num_int)

    # Synthesize clean 2-3 sentences
    sentence_1 = f"Section {clean_sec} of the Code of Criminal Procedure, 1973 governs matters relating to {clean_title.lower()} within the framework of {ch_name.lower()}."
    
    if cleaned_statutory and len(cleaned_statutory) > 50 and len(cleaned_statutory) < 320:
        sentence_2 = f"Under its provisions, {cleaned_statutory}"
        sentence_3 = f"This section establishes the mandatory procedural rules, legal obligations, and rights applicable during criminal proceedings under this Code."
        return f"{sentence_1} {sentence_2} {sentence_3}"
    else:
        sentence_2 = f"It prescribes the statutory procedure, supervisory authority, and legal standards required when dealing with {clean_title.lower()}."
        sentence_3 = f"These provisions ensure fair enforcement, judicial regularity, and adherence to due process across police and court proceedings."
        return f"{sentence_1} {sentence_2} {sentence_3}"

async def main():
    print("=" * 60)
    print("STEP 1: Fetching crpc.json from GitHub...")
    print("=" * 60)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get("https://raw.githubusercontent.com/Tejanshu9/legal-mind/main/data/crpc.json")
        crpc_raw = r.json()

    sec_chunks = {}
    for item in crpc_raw:
        meta = item.get("metadata", {})
        s_num = meta.get("section_number")
        if s_num:
            s_num = str(s_num).strip()
            sec_chunks.setdefault(s_num, []).append(item.get("text", ""))

    print(f"[OK] Downloaded {len(crpc_raw)} chunks for {len(sec_chunks)} sections.")

    print("\n" + "=" * 60)
    print("STEP 2: Enhancing section_mappings.json for all CrPC sections...")
    print("=" * 60)

    json_path = "backend/data/section_mappings.json"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    crpc_count = 0
    enhanced_records = []

    for entry in data:
        if entry.get("old_act") == "CRPC":
            crpc_count += 1
            sec = entry.get("old_section", "")
            title = entry.get("old_title", "")
            notes = entry.get("mapping_notes", "")

            # Look up chunks from crpc.json
            m = re.match(r"^(\d+)", sec)
            raw_text = ""
            if m and m.group(1) in sec_chunks:
                raw_text = " ".join(sec_chunks[m.group(1)])

            enhanced_desc = generate_crpc_description(sec, title, raw_text, notes)
            entry["old_text"] = enhanced_desc
            enhanced_records.append({
                "old_section": sec,
                "old_title": title,
                "old_text": enhanced_desc
            })

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[OK] Enhanced {crpc_count} CrPC sections in {json_path}")
    print("\nSample Enhanced CrPC Sections:")
    for sample in enhanced_records[:4]:
        print(f"\nSection {sample['old_section']} ({sample['old_title']}):")
        print(sample["old_text"])

    print("\n" + "=" * 60)
    print("STEP 3: Updating remote Supabase PostgreSQL database...")
    print("=" * 60)

    url = "postgresql+asyncpg://postgres.aaexeshzfonwpuaohsxl:Vivekmahajan@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
    engine = create_async_engine(url, connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0})

    updated_db_count = 0
    async with engine.begin() as conn:
        for rec in enhanced_records:
            sec = rec["old_section"]
            new_text = rec["old_text"]
            res = await conn.execute(
                text("UPDATE section_mapping SET old_text = :txt WHERE old_act = 'CRPC' AND old_section = :sec"),
                {"txt": new_text, "sec": sec}
            )
            updated_db_count += res.rowcount

    print(f"[OK] Successfully updated {updated_db_count} records in remote Supabase database!")

if __name__ == "__main__":
    asyncio.run(main())
