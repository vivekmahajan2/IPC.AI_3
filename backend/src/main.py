from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import init_db
from .core.security import hash_password
from .api import (
    auth_router, fir_router, legal_router, compare_router,
    judgments_router, lawyers_router, history_router, admin_router,
    other_law_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    await init_db()

    # Create default admin user if none exists
    from .core.database import async_session
    from .models.user import User, UserRole
    from .models.mapping import SectionMapping
    from .models.judgment import Judgment
    from .models.lawyer import Lawyer
    from sqlalchemy import select, func
    import json
    import os

    async with async_session() as session:
        # --- Default admin user ---
        result = await session.execute(
            select(User).where(User.role == UserRole.ADMIN)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            admin_user = User(
                email="admin@ipc.ai",
                password_hash=hash_password("admin123"),
                full_name="System Admin",
                role=UserRole.ADMIN,
                verified=True,
            )
            session.add(admin_user)
            await session.commit()
            print("[OK] Default admin user created: admin@ipc.ai / admin123")

        # --- Default police officer for testing ---
        result = await session.execute(
            select(User).where(User.email == "officer@police.gov.in")
        )
        officer = result.scalar_one_or_none()
        if not officer:
            officer_user = User(
                email="officer@police.gov.in",
                password_hash=hash_password("officer123"),
                full_name="Inspector Rajesh Kumar",
                role=UserRole.POLICE,
                verified=True,
                badge_number="DL-PS-2024-0042",
                station="Central Delhi",
                phone="+91-9876543210",
            )
            session.add(officer_user)
            await session.commit()
            print("[OK] Default police officer created: officer@police.gov.in / officer123")

        # --- Default superior officer for testing ---
        result = await session.execute(
            select(User).where(User.email == "dsp@police.gov.in")
        )
        sup = result.scalar_one_or_none()
        if not sup:
            sup_user = User(
                email="dsp@police.gov.in",
                password_hash=hash_password("dsp12345"),
                full_name="DSP Priya Sharma",
                role=UserRole.SUPERIOR,
                verified=True,
                badge_number="DL-DSP-2020-0011",
                station="Central Delhi",
            )
            session.add(sup_user)
            await session.commit()
            print("[OK] Default superior officer created: dsp@police.gov.in / dsp12345")

        # --- Seed section mappings ---
        count_result = await session.execute(select(func.count(SectionMapping.id)))
        mapping_count = count_result.scalar() or 0
        if mapping_count == 0:
            data_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "section_mappings.json",
            )
            if os.path.exists(data_file):
                with open(data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                mappings = data if isinstance(data, list) else data.get("mappings", [])
                for item in mappings:
                    mapping = SectionMapping(
                        old_act=item.get("old_act", ""),
                        old_section=item.get("old_section", ""),
                        old_title=item.get("old_title"),
                        old_text=item.get("old_text"),
                        new_act=item.get("new_act", ""),
                        new_section=item.get("new_section", ""),
                        new_title=item.get("new_title"),
                        new_text=item.get("new_text"),
                        mapping_notes=item.get("mapping_notes"),
                        is_identical=item.get("is_identical", False),
                    )
                    session.add(mapping)
                await session.commit()
                print(f"[OK] Seeded {len(mappings)} section mappings")

        # --- Seed sample judgments ---
        judgment_count_result = await session.execute(select(func.count(Judgment.id)))
        judgment_count = judgment_count_result.scalar() or 0
        if judgment_count == 0:
            from datetime import date
            sample_judgments = [
                Judgment(
                    case_title="State of Maharashtra v. Mohd. Yakub",
                    court_name="Supreme Court of India",
                    bench="A.N. Ray, C.J.",
                    judgment_date=date(1980, 2, 13),
                    citation="1980 AIR 1111",
                    case_number="Criminal Appeal No. 195/1979",
                    summary="The Supreme Court held that the police officers acting in good faith are protected under law. Established principles regarding the power of search and seizure under CrPC.",
                ),
                Judgment(
                    case_title="K.M. Nanavati v. State of Maharashtra",
                    court_name="Supreme Court of India",
                    bench="S.K. Das, J.",
                    judgment_date=date(1962, 11, 24),
                    citation="1962 AIR 605",
                    case_number="Criminal Appeal No. 28/1960",
                    summary="The landmark case that abolished jury trials in India. The accused, a naval officer, was charged under Section 302 IPC for murder. The case redefined the scope of 'grave and sudden provocation' as a defence.",
                ),
                Judgment(
                    case_title="Bachan Singh v. State of Punjab",
                    court_name="Supreme Court of India",
                    bench="Y.V. Chandrachud, C.J.",
                    judgment_date=date(1980, 5, 9),
                    citation="1980 AIR 898",
                    case_number="Criminal Appeal No. 273/1979",
                    summary="The 'rarest of rare' doctrine for death penalty was established in this case. The Court upheld the constitutionality of the death penalty under Section 302 IPC but restricted its application.",
                ),
                Judgment(
                    case_title="Lalita Kumari v. Government of U.P.",
                    court_name="Supreme Court of India",
                    bench="P. Sathasivam, J.",
                    judgment_date=date(2013, 11, 12),
                    citation="(2014) 2 SCC 1",
                    case_number="Writ Petition (Crl.) No. 68/2008",
                    summary="The Supreme Court mandated that FIR must be registered on receiving information disclosing commission of a cognizable offence under Section 154 CrPC, without conducting preliminary inquiry.",
                ),
                Judgment(
                    case_title="Arnesh Kumar v. State of Bihar",
                    court_name="Supreme Court of India",
                    bench="C.K. Prasad, J.",
                    judgment_date=date(2014, 7, 2),
                    citation="(2014) 8 SCC 273",
                    case_number="Criminal Appeal No. 1277/2014",
                    summary="Guidelines issued to prevent automatic arrests in cases punishable with imprisonment up to 7 years. Police must satisfy themselves about necessity of arrest under Section 41 CrPC before making an arrest.",
                ),
            ]
            for j in sample_judgments:
                session.add(j)
            await session.commit()
            print(f"[OK] Seeded {len(sample_judgments)} sample judgments")

        # --- Seed sample lawyers ---
        lawyer_count_result = await session.execute(select(func.count(Lawyer.id)))
        lawyer_count = lawyer_count_result.scalar() or 0
        if lawyer_count == 0:
            sample_lawyers = [
                Lawyer(
                    bar_council_id="DL/1234/2015",
                    name="Adv. Sanjay Mehta",
                    firm_name="Mehta & Associates",
                    specialization=["Criminal Law", "Bail Matters", "Murder Cases"],
                    practicing_courts=["Supreme Court", "Delhi High Court", "District Courts"],
                    years_of_exp=15,
                    phone="+91-9876500001",
                    email="sanjay@mehtaassociates.in",
                    address="A-12, Tis Hazari Courts, Delhi",
                    city="New Delhi",
                    languages=["Hindi", "English"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="MH/5678/2018",
                    name="Adv. Priya Desai",
                    firm_name="Desai Legal Chambers",
                    specialization=["Cyber Crime", "White Collar Crime", "NDPS Act"],
                    practicing_courts=["Bombay High Court", "Sessions Court Mumbai"],
                    years_of_exp=8,
                    phone="+91-9876500002",
                    email="priya@desailegal.in",
                    address="Fort Area, Mumbai",
                    city="Mumbai",
                    languages=["Hindi", "English", "Marathi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="KA/9012/2012",
                    name="Adv. Ramesh Rao",
                    specialization=["Criminal Law", "Property Disputes", "Domestic Violence"],
                    practicing_courts=["Karnataka High Court", "District Courts Bengaluru"],
                    years_of_exp=12,
                    phone="+91-9876500003",
                    email="ramesh.rao@lawmail.in",
                    address="MG Road, Bengaluru",
                    city="Bengaluru",
                    languages=["Kannada", "Hindi", "English"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="UP/3456/2020",
                    name="Adv. Anita Singh",
                    specialization=["Juvenile Justice", "Women's Rights", "SC/ST Act"],
                    practicing_courts=["Allahabad High Court", "Family Courts Lucknow"],
                    years_of_exp=5,
                    phone="+91-9876500004",
                    email="anita.singh@legal.in",
                    address="Hazratganj, Lucknow",
                    city="Lucknow",
                    languages=["Hindi", "English"],
                    is_verified=False,
                ),
            ]

            # Additional civil/other law specialized lawyers
            sample_lawyers.extend([
                Lawyer(
                    bar_council_id="MH/4321/2010",
                    name="Adv. Madhav Rao",
                    firm_name="Rao & Partners",
                    specialization=["Contract Law", "Property Disputes", "Civil litigation"],
                    practicing_courts=["Bombay High Court", "City Civil Court Mumbai"],
                    years_of_exp=16,
                    phone="+91-9876500010",
                    email="madhav@raopartners.in",
                    address="Nariman Point, Mumbai",
                    city="Mumbai",
                    languages=["English", "Marathi", "Hindi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="DL/9876/2014",
                    name="Adv. Sunita Sharma",
                    firm_name="Sharma Family Legal",
                    specialization=["Divorce & Family Law", "Succession Certificate", "Marriage Disputes"],
                    practicing_courts=["Delhi High Court", "Saket Family Courts"],
                    years_of_exp=10,
                    phone="+91-9876500011",
                    email="sunita@sharmalegal.in",
                    address="Saket, New Delhi",
                    city="New Delhi",
                    languages=["English", "Hindi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="KA/5678/2011",
                    name="Adv. Karan Johar",
                    firm_name="Karan & Associates",
                    specialization=["Company Law", "Banking & Finance", "Insolvency & Bankruptcy"],
                    practicing_courts=["Karnataka High Court", "NCLT Bengaluru"],
                    years_of_exp=13,
                    phone="+91-9876500012",
                    email="karan@karanassociates.in",
                    address="Indiranagar, Bengaluru",
                    city="Bengaluru",
                    languages=["English", "Kannada", "Hindi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="UP/8765/2017",
                    name="Adv. Deepika Verma",
                    specialization=["Cyber Crimes", "IT Act Compliance", "Defamation"],
                    practicing_courts=["Allahabad High Court", "Lucknow District Court"],
                    years_of_exp=7,
                    phone="+91-9876500013",
                    email="deepika.verma@cyberlegal.in",
                    address="Gomti Nagar, Lucknow",
                    city="Lucknow",
                    languages=["English", "Hindi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="MH/7654/2013",
                    name="Adv. Vijay Kadam",
                    specialization=["Labour Law", "Industrial Disputes", "Employment Law"],
                    practicing_courts=["Industrial Court Maharashtra", "Bombay High Court"],
                    years_of_exp=11,
                    phone="+91-9876500014",
                    email="vijay.kadam@labourlaw.in",
                    address="Thane, Mumbai",
                    city="Mumbai",
                    languages=["English", "Marathi", "Hindi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="MH/6543/2015",
                    name="Adv. Sachin Patil",
                    specialization=["Maharashtra State Laws", "Property Disputes", "Land Revenue"],
                    practicing_courts=["Pune District Court", "Bombay High Court"],
                    years_of_exp=9,
                    phone="+91-9876500015",
                    email="sachin.patil@statelaw.in",
                    address="Shivajinagar, Pune",
                    city="Pune",
                    languages=["English", "Marathi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="DL/1122/2016",
                    name="Adv. Rashi Gupta",
                    specialization=["Income Tax", "GST Compliance", "Tax Litigation"],
                    practicing_courts=["Delhi High Court", "ITAT Delhi"],
                    years_of_exp=8,
                    phone="+91-9876500016",
                    email="rashi@guptatax.in",
                    address="Connaught Place, New Delhi",
                    city="New Delhi",
                    languages=["English", "Hindi"],
                    is_verified=True,
                ),
                Lawyer(
                    bar_council_id="KA/3344/2012",
                    name="Adv. Anand Joshi",
                    specialization=["Food Safety Laws", "FSSAI Regulation", "Consumer Law"],
                    practicing_courts=["Karnataka High Court", "District Forum Bengaluru"],
                    years_of_exp=12,
                    phone="+91-9876500017",
                    email="anand@joshilegal.in",
                    address="Jayanagar, Bengaluru",
                    city="Bengaluru",
                    languages=["English", "Kannada"],
                    is_verified=True,
                ),
            ])

            for l in sample_lawyers:
                session.add(l)
            await session.commit()
            print(f"[OK] Seeded {len(sample_lawyers)} sample lawyers")

        # --- Seed sample other law statutes ---
        from .models.other_law import OtherLawStatute
        other_law_count_result = await session.execute(select(func.count(OtherLawStatute.id)))
        other_law_count = other_law_count_result.scalar() or 0
        if other_law_count == 0:
            sample_other_laws = [
                # Civil Law
                OtherLawStatute(
                    category="Civil Law", subcategory="Contract",
                    act_name="Indian Contract Act, 1872", section="Section 2(h)",
                    title="Definition of Contract",
                    description="An agreement enforceable by law is a contract. Every promise and every set of promises, forming the consideration for each other, is an agreement."
                ),
                OtherLawStatute(
                    category="Civil Law", subcategory="Contract",
                    act_name="Indian Contract Act, 1872", section="Section 10",
                    title="What agreements are contracts",
                    description="All agreements are contracts if they are made by the free consent of parties competent to contract, for a lawful consideration and with a lawful object, and are not hereby expressly declared to be void."
                ),
                OtherLawStatute(
                    category="Civil Law", subcategory="Property",
                    act_name="Transfer of Property Act, 1882", section="Section 54",
                    title="Sale Defined",
                    description="Sale is a transfer of ownership in exchange for a price paid or promised or part-paid and part-promised. Such transfer, in the case of tangible immovable property of the value of one hundred rupees and upwards, can be made only by a registered instrument."
                ),
                OtherLawStatute(
                    category="Civil Law", subcategory="Property",
                    act_name="Transfer of Property Act, 1882", section="Section 105",
                    title="Lease Defined",
                    description="A lease of immovable property is a transfer of a right to enjoy such property, made for a certain time, express or implied, or in perpetuity, in consideration of a price paid or promised, or of money, a share of crops, service or any other thing of value."
                ),
                OtherLawStatute(
                    category="Civil Law", subcategory="Tort",
                    act_name="Law of Torts", section="Negligence",
                    title="Elements of Negligence",
                    description="Negligence is the breach of a legal duty to take care which results in damage, undesired by the defendant, to the plaintiff. Elements: (1) Duty of care, (2) Breach of that duty, (3) Damage caused by the breach."
                ),
                OtherLawStatute(
                    category="Civil Law", subcategory="Civil Procedure",
                    act_name="Code of Civil Procedure, 1908", section="Section 9",
                    title="Courts to try all civil suits unless barred",
                    description="The Courts shall (subject to the provisions herein contained) have jurisdiction to try all suits of a civil nature excepting suits of which their cognizance is either expressly or impliedly barred."
                ),
                OtherLawStatute(
                    category="Civil Law", subcategory="Civil Procedure",
                    act_name="Code of Civil Procedure, 1908", section="Order 39 Rule 1",
                    title="Cases in which temporary injunction may be granted",
                    description="Where in any suit it is proved by affidavit or otherwise that any property in dispute is in danger of being wasted, damaged or alienated by any party, or to prevent the defendant from removing or disposing of his property, the Court may grant a temporary injunction."
                ),

                # Family Law
                OtherLawStatute(
                    category="Family Law", subcategory="Marriage",
                    act_name="Hindu Marriage Act, 1955", section="Section 5",
                    title="Conditions for a Hindu Marriage",
                    description="A marriage may be solemnized between any two Hindus if: neither party has a spouse living at the time; neither party is incapable of giving valid consent; bridegroom has completed age of 21 and bride 18; they are not within degrees of prohibited relationship unless custom allows."
                ),
                OtherLawStatute(
                    category="Family Law", subcategory="Divorce",
                    act_name="Hindu Marriage Act, 1955", section="Section 13",
                    title="Divorce Grounds",
                    description="Any marriage solemnized, whether before or after the commencement of this Act, may, on a petition presented by either the husband or the wife, be dissolved by a decree of divorce on the ground that the other party has committed adultery, cruelty, desertion, conversion, unsound mind, etc."
                ),
                OtherLawStatute(
                    category="Family Law", subcategory="Succession",
                    act_name="Indian Succession Act, 1925", section="Section 63",
                    title="Execution of unprivileged Wills",
                    description="Every testator shall sign or shall affix his mark to the Will, or some other person shall sign it in his presence and by his direction. The Will shall be attested by two or more witnesses, each of whom has seen the testator sign or affix his mark."
                ),

                # Commercial Law
                OtherLawStatute(
                    category="Commercial Law", subcategory="Companies",
                    act_name="Companies Act, 2013", section="Section 2(20)",
                    title="Definition of Company",
                    description="Company means a company incorporated under this Act or under any previous company law."
                ),
                OtherLawStatute(
                    category="Commercial Law", subcategory="LLP",
                    act_name="Limited Liability Partnership Act, 2008", section="Section 3",
                    title="LLP to be body corporate",
                    description="A limited liability partnership is a body corporate formed and incorporated under this Act and is a legal entity separate from that of its partners. An LLP shall have perpetual succession."
                ),
                OtherLawStatute(
                    category="Commercial Law", subcategory="IBC",
                    act_name="Insolvency and Bankruptcy Code, 2016", section="Section 6",
                    title="Persons who may initiate CIRP",
                    description="Where any corporate debtor commits a default, a financial creditor, an operational creditor or the corporate debtor itself may initiate corporate insolvency resolution process (CIRP) in respect of such corporate debtor."
                ),

                # Cyber Law
                OtherLawStatute(
                    category="Cyber Law", subcategory="IT Act",
                    act_name="Information Technology Act, 2000", section="Section 43",
                    title="Penalty and compensation for damage to computer system",
                    description="If any person without permission of the owner accesses, downloads, copies, introduces virus, damages, disrupts, or denies access to any computer or network, he shall be liable to pay damages by way of compensation to the person so affected."
                ),
                OtherLawStatute(
                    category="Cyber Law", subcategory="Cyber Crimes",
                    act_name="Information Technology Act, 2000", section="Section 66C",
                    title="Punishment for identity theft",
                    description="Whoever, fraudulently or dishonestly make use of the electronic signature, password or any other unique identification feature of any other person, shall be punished with imprisonment of either description for a term which may extend to three years and shall also be liable to fine."
                ),

                # Labour Law
                OtherLawStatute(
                    category="Labour Law", subcategory=None,
                    act_name="Industrial Disputes Act, 1947", section="Section 2(k)",
                    title="Industrial Dispute definition",
                    description="Any dispute or difference between employers and employers, or between employers and workmen, or between workmen and workmen, which is connected with the employment or non-employment or the terms of employment or with the conditions of labour, of any person."
                ),
                OtherLawStatute(
                    category="Labour Law", subcategory=None,
                    act_name="Minimum Wages Act, 1948", section="Section 12",
                    title="Payment of minimum rates of wages",
                    description="Where in respect of any scheduled employment a notification under section 5 is in force, the employer shall pay to every employee engaged in a scheduled employment under him wages at a rate not less than the minimum rate of wages fixed by such notification for that class of employees."
                ),

                # State Laws
                OtherLawStatute(
                    category="State Laws", subcategory="Maharashtra",
                    act_name="Maharashtra Police Act, 1951", section="Section 33",
                    title="Power to make rules for regulation of traffic, etc.",
                    description="The Commissioner and the District Magistrate may make, alter or rescind rules for licensing, controlling, and regulating vehicles, public places, processions, and music to maintain order and traffic safety."
                ),

                # Tax Law
                OtherLawStatute(
                    category="Tax Law", subcategory=None,
                    act_name="Income Tax Act, 1961", section="Section 4",
                    title="Charge of income-tax",
                    description="Where any Central Act enacts that income-tax shall be charged for any assessment year at any rate or rates, income-tax at that rate or those rates shall be charged for that year in accordance with, and subject to the provisions of, this Act in respect of the total income of the previous year of every person."
                ),

                # Food Law
                OtherLawStatute(
                    category="Food Law", subcategory=None,
                    act_name="Food Safety and Standards Act, 2006", section="Section 31",
                    title="Licensing and registration of food business",
                    description="No person shall commence or carry on any food business except under a license. The Commissioner of Food Safety shall ensure that all food business operators in his jurisdiction comply with such conditions."
                ),
            ]
            for ol in sample_other_laws:
                session.add(ol)
            await session.commit()
            print(f"[OK] Seeded {len(sample_other_laws)} other law statutes")


    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered legal assistant for Indian law enforcement",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(fir_router)
app.include_router(legal_router)
app.include_router(compare_router)
app.include_router(judgments_router)
app.include_router(lawyers_router)
app.include_router(history_router)
app.include_router(admin_router)
app.include_router(other_law_router)



@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
