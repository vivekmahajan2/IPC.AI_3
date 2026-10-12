from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.dictionary import LegalDictionary

router = APIRouter(prefix="/dictionary", tags=["Legal Dictionary"])


class DictionaryResponse(BaseModel):
    id: int
    term: str
    definition: str
    simple_explanation: str
    related_provisions: List[str] = []
    examples: Optional[str] = None
    category: str

    class Config:
        from_attributes = True


INITIAL_TERMS = [
    {
        "term": "Cognizable Offence",
        "definition": "An offence for which a police officer may, in accordance with the First Schedule or any other law, arrest without warrant.",
        "simple_explanation": "Serious crimes (like murder, theft, rape) where police can start investigation and arrest the accused immediately without waiting for a court warrant.",
        "related_provisions": ["Section 2(1)(g) BNSS", "Section 2(c) CrPC", "Section 173 BNSS"],
        "examples": "Offences under BNS 103 (Murder), BNS 303 (Theft), and BNS 63 (Rape) are cognizable.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Non-Cognizable Offence",
        "definition": "An offence for which a police officer has no authority to arrest without warrant.",
        "simple_explanation": "Less severe crimes (like simple defamation or minor assault) where police cannot arrest or investigate without formal permission/warrant from a Magistrate.",
        "related_provisions": ["Section 2(1)(o) BNSS", "Section 2(l) CrPC", "Section 174 BNSS"],
        "examples": "Defamation (BNS 356) and public nuisance are non-cognizable.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Bail",
        "definition": "The temporary release of an accused person awaiting trial or appeal, upon security deposit or personal bond guaranteeing appearance.",
        "simple_explanation": "Procuring the release of an accused person from police or jail custody while their case is pending, usually under court-mandated conditions.",
        "related_provisions": ["Section 478-482 BNSS", "Section 436-439 CrPC"],
        "examples": "An accused arrested for cheating may furnish bail bonds to be released pending trial.",
        "category": "Bail & Custody",
    },
    {
        "term": "Anticipatory Bail",
        "definition": "A pre-arrest legal relief granted by the Sessions Court or High Court directing police to release the applicant on bail in the event of an arrest.",
        "simple_explanation": "A court order shielding a person from jail if they apprehend that an arrest might be made on false or motivated accusations.",
        "related_provisions": ["Section 482 BNSS", "Section 438 CrPC"],
        "examples": "A business owner facing false allegations of fraud may apply for anticipatory bail to prevent harassment.",
        "category": "Bail & Custody",
    },
    {
        "term": "Zero FIR",
        "definition": "A First Information Report registered at any police station irrespective of the territorial jurisdiction where the incident occurred.",
        "simple_explanation": "A rule ensuring police cannot turn away a victim claiming 'this area is not under our jurisdiction'. Any station must register the FIR and transfer it to the concerned police station.",
        "related_provisions": ["Section 173(1) BNSS", "Lalita Kumari v. Govt of UP"],
        "examples": "A train passenger attacked in transit can register a Zero FIR at the destination station.",
        "category": "FIR & Investigation",
    },
    {
        "term": "Charge Sheet",
        "definition": "A formal final police report submitted before the Magistrate under Section 193 BNSS concluding that sufficient evidence exists to prosecute the accused.",
        "simple_explanation": "The final document submitted by police after finishing their investigation, listing the evidence and requesting the court to put the accused on trial.",
        "related_provisions": ["Section 193 BNSS", "Section 173(2) CrPC"],
        "examples": "The investigating officer filed the charge sheet within 90 days citing ocular and forensic ballistic evidence.",
        "category": "Investigation",
    },
    {
        "term": "Inquest",
        "definition": "A preliminary inquiry conducted by police or an Executive Magistrate to ascertain the apparent cause of unnatural, suspicious, or custodial death.",
        "simple_explanation": "The initial official inspection of a deceased person's body and surrounding scene to find out how, when, and by what weapon they died.",
        "related_provisions": ["Section 194-196 BNSS", "Section 174-176 CrPC"],
        "examples": "Police conducted an inquest report (panchnama) before sending the body for post-mortem.",
        "category": "Investigation",
    },
    {
        "term": "Dying Declaration",
        "definition": "A statement made by a deceased person regarding the cause or circumstances of their death, admissible as substantive evidence without cross-examination.",
        "simple_explanation": "The last words of a dying victim explaining who injured them or how they died, given high legal value because a dying person is presumed not to lie.",
        "related_provisions": ["Section 26 BSA", "Section 32(1) Indian Evidence Act"],
        "examples": "A burn victim's recorded statement to the Executive Magistrate identifying the attacker is treated as a dying declaration.",
        "category": "Evidence Law",
    },
    {
        "term": "Mens Rea",
        "definition": "The mental element of intention, knowledge, or recklessness required to establish criminal liability alongside the physical act.",
        "simple_explanation": "A guilty mind or criminal intent. In criminal law, a physical act usually does not constitute an offence unless accompanied by an intentional mental state.",
        "related_provisions": ["Chapter III BNS (General Exceptions)", "Section 14 BSA"],
        "examples": "An accidental collision with no reckless intent lacks mens rea for intentional murder.",
        "category": "Substantive Law",
    },
    {
        "term": "Remand",
        "definition": "An order of the Magistrate directing the custody of an arrested accused either to police custody or judicial (jail) custody.",
        "simple_explanation": "Sending the accused back into police custody (for interrogation/recovery) or judicial custody (jail) when an investigation cannot be completed in 24 hours.",
        "related_provisions": ["Section 187 BNSS", "Section 167 CrPC"],
        "examples": "Police requested 5 days police remand to recover the stolen firearm from the accused's hideout.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Habeas Corpus",
        "definition": "A prerogative writ issued by the High Court or Supreme Court commanding an authority holding a person in custody to produce that person before the court.",
        "simple_explanation": "A court order to release someone who has been detained illegally or without lawful justification.",
        "related_provisions": ["Article 32 & 226 Constitution of India"],
        "examples": "A family files a habeas corpus petition when an individual is unlawfully held by police without being produced before a Magistrate.",
        "category": "Constitutional Law",
    },
    {
        "term": "Quashing of FIR",
        "definition": "The extraordinary exercise of inherent jurisdiction by the High Court under Section 528 BNSS (or Section 482 CrPC) to annul an FIR and stop criminal proceedings.",
        "simple_explanation": "A High Court order completely striking down an FIR when the allegations are frivolous, civil in nature, or an abuse of the court process.",
        "related_provisions": ["Section 528 BNSS", "Section 482 CrPC"],
        "examples": "The High Court quashed the FIR after parties reached a full civil settlement without coercion.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Affidavit",
        "definition": "A written statement confirmed by oath or solemn affirmation, for use as evidence in court or official administrative proceedings.",
        "simple_explanation": "A legally binding signed statement sworn before an oath commissioner or notary confirming that the stated facts are true to the best of knowledge.",
        "related_provisions": ["Section 333 BNSS", "Section 297 CrPC", "Order 19 CPC"],
        "examples": "The complainant submitted a sworn affidavit verifying the inventory of stolen property.",
        "category": "Evidence Law",
    },
    {
        "term": "Injunction",
        "definition": "A judicial order restraining a person from beginning or continuing an action threatening or invading the legal right of another, or compelling them to perform an act.",
        "simple_explanation": "A stay order or restraining order issued by a court preventing someone from doing an unlawful act like demolishing a disputed property.",
        "related_provisions": ["Order 39 Rules 1 & 2 CPC", "Specific Relief Act 1963"],
        "examples": "The Civil Court granted a temporary injunction prohibiting the developer from trespassing onto the claimant's plot.",
        "category": "Civil Law",
    },
    {
        "term": "Panchnama",
        "definition": "A record of witness observations drawn up by investigating police officers in the presence of independent witnesses (panchas) documenting search, seizure, or scene inspection.",
        "simple_explanation": "An on-the-spot document witnessed and signed by independent local citizens recording what police found or seized at a crime scene.",
        "related_provisions": ["Section 105 BNSS", "Section 100 CrPC"],
        "examples": "Police prepared a recovery panchnama when the weapon was recovered from the suspect's vehicle.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Default Bail",
        "definition": "An indefeasible statutory right to bail under Section 187(3) BNSS (formerly Section 167(2) CrPC) upon failure of police to file a charge sheet within 60 or 90 days.",
        "simple_explanation": "Automatic right to be released on bail if the police fail to file their charge sheet within the legally mandated time limit (60 or 90 days).",
        "related_provisions": ["Section 187(3) BNSS", "Section 167(2) CrPC"],
        "examples": "The court granted default bail after the investigating agency exceeded 90 days without presenting a final report.",
        "category": "Bail & Custody",
    },
    {
        "term": "Discharge",
        "definition": "The termination of criminal proceedings by a Magistrate or Sessions Judge prior to framing formal charges when allegations are considered groundless.",
        "simple_explanation": "The court frees the accused before trial begins because even if all allegations were true, they do not legally constitute a crime.",
        "related_provisions": ["Section 250 & 262 BNSS", "Section 227 & 239 CrPC"],
        "examples": "The Sessions Court discharged the accused after finding no prima facie evidence linking him to the conspiracy.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Acquittal",
        "definition": "A formal judgment by a court of competent jurisdiction declaring an accused person not guilty of the criminal offences charged following a full trial.",
        "simple_explanation": "A complete judicial clearance declaring the accused innocent after examining all witnesses and evidence during the trial.",
        "related_provisions": ["Section 255 & 268 BNSS", "Section 232 & 248 CrPC"],
        "examples": "The prosecution failed to prove guilt beyond reasonable doubt, resulting in an honorable acquittal.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Confession",
        "definition": "An admission made at any time by a person charged with a crime, stating or suggesting the inference that they committed that crime.",
        "simple_explanation": "An admission of guilt. In Indian law, confessions made to police officers are inadmissible in court, whereas confessions before a Magistrate are admissible.",
        "related_provisions": ["Section 22-24 BSA", "Section 25-26 Indian Evidence Act", "Section 183 BNSS"],
        "examples": "A judicial confession recorded under Section 183 BNSS by the Judicial Magistrate can be used against the accused.",
        "category": "Evidence Law",
    },
    {
        "term": "Plea Bargaining",
        "definition": "A pre-trial negotiation process between the accused and the prosecution where the accused pleads guilty to a lesser charge or sentence concession.",
        "simple_explanation": "A mutual settlement mechanism where an accused admits guilt for minor offences to avoid prolonged trial and receive a reduced sentence.",
        "related_provisions": ["Chapter XXI BNSS (Section 289-300)", "Chapter XXIA CrPC"],
        "examples": "The first-time offender applied for plea bargaining for a non-heinous property dispute.",
        "category": "Criminal Procedure",
    },
    {
        "term": "Double Jeopardy",
        "definition": "The constitutional and statutory protection against being prosecuted and punished more than once for the exact same criminal offence.",
        "simple_explanation": "The state cannot put you on trial or punish you twice for the same criminal act once you have already been convicted or acquitted.",
        "related_provisions": ["Article 20(2) Constitution of India", "Section 337 BNSS", "Section 300 CrPC"],
        "examples": "After being acquitted of theft by a competent court, the accused cannot be retried on the identical facts.",
        "category": "Constitutional Law",
    },
    {
        "term": "First Information Report (FIR)",
        "definition": "A written document prepared by police under Section 173 BNSS upon receiving information concerning the commission of a cognizable offence.",
        "simple_explanation": "The foundational police record that sets the criminal law and police investigation machinery into motion.",
        "related_provisions": ["Section 173 BNSS", "Section 154 CrPC", "Lalita Kumari judgment"],
        "examples": "The station house officer registered the FIR immediately after receiving the victim's signed complaint.",
        "category": "FIR & Investigation",
    },
    {
        "term": "Sanhita",
        "definition": "A comprehensive code, compilation, or systematized collection of laws, referring specifically to the 2023 replacement criminal statutes in India.",
        "simple_explanation": "The term used for India's modern criminal codes: Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA).",
        "related_provisions": ["BNS 2023", "BNSS 2023", "BSA 2023"],
        "examples": "The new criminal Sanhitas came into nationwide enforcement on July 1, 2024.",
        "category": "Substantive Law",
    },
]


@router.get("", response_model=List[DictionaryResponse])
async def search_dictionary(
    q: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search and browse verified legal definitions with explanations and related sections."""
    query = select(LegalDictionary).order_by(LegalDictionary.term.asc())

    if q:
        search = f"%{q}%"
        query = query.where(
            or_(
                LegalDictionary.term.ilike(search),
                LegalDictionary.definition.ilike(search),
                LegalDictionary.simple_explanation.ilike(search),
                LegalDictionary.examples.ilike(search),
            )
        )
    if category:
        query = query.where(LegalDictionary.category.ilike(f"%{category}%"))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    terms = result.scalars().all()

    # If DB is empty, auto-seed with initial terms
    if not terms and not q:
        for t in INITIAL_TERMS:
            entry = LegalDictionary(
                term=t["term"],
                definition=t["definition"],
                simple_explanation=t["simple_explanation"],
                related_provisions=t["related_provisions"],
                examples=t["examples"],
                category=t["category"],
            )
            db.add(entry)
        await db.commit()
        result = await db.execute(select(LegalDictionary).order_by(LegalDictionary.term.asc()))
        terms = result.scalars().all()

    return terms


@router.get("/{term_name}", response_model=DictionaryResponse)
async def get_term_detail(
    term_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(LegalDictionary).where(LegalDictionary.term.ilike(term_name))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail=f"Legal term '{term_name}' not found")
    return item
