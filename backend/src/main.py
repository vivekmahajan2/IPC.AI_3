from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import init_db
from .core.security import hash_password
from .api import (
    auth_router, fir_router, legal_router, compare_router,
    judgments_router, lawyers_router, history_router, admin_router,
    other_law_router, complaints_router, dictionary_router,
    lawyer_workspace_router,
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

        # --- Seed other law statutes ---
        from .models.other_law import OtherLawStatute
        other_law_count_result = await session.execute(select(func.count(OtherLawStatute.id)))
        other_law_count = other_law_count_result.scalar() or 0
        if other_law_count < 100:
            json_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "other_law_statutes.json",
            )
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f_ol:
                    ol_data = json.load(f_ol)
                for item in ol_data:
                    session.add(
                        OtherLawStatute(
                            category=item["category"],
                            subcategory=item.get("subcategory"),
                            act_name=item["act_name"],
                            section=item["section"],
                            title=item["title"],
                            description=item["description"],
                        )
                    )
                await session.commit()
                print(f"[OK] Seeded {len(ol_data)} other law statutes from JSON")


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
app.include_router(complaints_router)
app.include_router(dictionary_router)
app.include_router(lawyer_workspace_router)



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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.src.main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)

