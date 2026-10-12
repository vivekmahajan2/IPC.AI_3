from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.lawyer_workspace import LawyerCaseNote, LawyerBookmark

router = APIRouter(prefix="/lawyer", tags=["Lawyer Workspace"])


# --- Schemas ---

class CaseNoteCreate(BaseModel):
    case_title: str
    court_name: Optional[str] = None
    case_number: Optional[str] = None
    sections_involved: List[str] = []
    client_name: Optional[str] = None
    notes_content: str
    hearing_date: Optional[str] = None


class CaseNoteUpdate(BaseModel):
    case_title: Optional[str] = None
    court_name: Optional[str] = None
    case_number: Optional[str] = None
    sections_involved: Optional[List[str]] = None
    client_name: Optional[str] = None
    notes_content: Optional[str] = None
    hearing_date: Optional[str] = None


class CaseNoteResponse(BaseModel):
    id: int
    user_id: int
    case_title: str
    court_name: Optional[str] = None
    case_number: Optional[str] = None
    sections_involved: List[str] = []
    client_name: Optional[str] = None
    notes_content: str
    hearing_date: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookmarkCreate(BaseModel):
    item_type: str  # "judgment", "statute", "dictionary"
    item_id: Optional[str] = None
    title: str
    citation: Optional[str] = None
    notes: Optional[str] = None


class BookmarkResponse(BaseModel):
    id: int
    user_id: int
    item_type: str
    item_id: Optional[str] = None
    title: str
    citation: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Case Notes Endpoints ---

@router.get("/notes", response_model=List[CaseNoteResponse])
async def list_case_notes(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List case notes belonging to the current user."""
    result = await db.execute(
        select(LawyerCaseNote)
        .where(LawyerCaseNote.user_id == current_user.id)
        .order_by(desc(LawyerCaseNote.updated_at))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/notes", response_model=CaseNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_case_note(
    req: CaseNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new case diary note."""
    note = LawyerCaseNote(
        user_id=current_user.id,
        case_title=req.case_title,
        court_name=req.court_name,
        case_number=req.case_number,
        sections_involved=req.sections_involved,
        client_name=req.client_name,
        notes_content=req.notes_content,
        hearing_date=req.hearing_date,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("/notes/{note_id}", response_model=CaseNoteResponse)
async def get_case_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details of a specific case note."""
    result = await db.execute(
        select(LawyerCaseNote).where(
            LawyerCaseNote.id == note_id,
            LawyerCaseNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Case note not found")
    return note


@router.put("/notes/{note_id}", response_model=CaseNoteResponse)
async def update_case_note(
    note_id: int,
    req: CaseNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a case note."""
    result = await db.execute(
        select(LawyerCaseNote).where(
            LawyerCaseNote.id == note_id,
            LawyerCaseNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Case note not found")

    if req.case_title is not None:
        note.case_title = req.case_title
    if req.court_name is not None:
        note.court_name = req.court_name
    if req.case_number is not None:
        note.case_number = req.case_number
    if req.sections_involved is not None:
        note.sections_involved = req.sections_involved
    if req.client_name is not None:
        note.client_name = req.client_name
    if req.notes_content is not None:
        note.notes_content = req.notes_content
    if req.hearing_date is not None:
        note.hearing_date = req.hearing_date

    note.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/notes/{note_id}")
async def delete_case_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a case note."""
    result = await db.execute(
        select(LawyerCaseNote).where(
            LawyerCaseNote.id == note_id,
            LawyerCaseNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Case note not found")

    await db.delete(note)
    await db.commit()
    return {"message": "Case note deleted successfully", "id": note_id}


# --- Bookmarks Endpoints ---

@router.get("/bookmarks", response_model=List[BookmarkResponse])
async def list_bookmarks(
    item_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List bookmarked judgments, statutes, or dictionary terms for the current user."""
    query = select(LawyerBookmark).where(LawyerBookmark.user_id == current_user.id)
    if item_type:
        query = query.where(LawyerBookmark.item_type == item_type)
    query = query.order_by(desc(LawyerBookmark.created_at))

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/bookmarks", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def add_bookmark(
    req: BookmarkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bookmark a legal precedent judgment or statutory section."""
    bookmark = LawyerBookmark(
        user_id=current_user.id,
        item_type=req.item_type,
        item_id=req.item_id,
        title=req.title,
        citation=req.citation,
        notes=req.notes,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.delete("/bookmarks/{bookmark_id}")
async def remove_bookmark(
    bookmark_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a bookmark."""
    result = await db.execute(
        select(LawyerBookmark).where(
            LawyerBookmark.id == bookmark_id,
            LawyerBookmark.user_id == current_user.id,
        )
    )
    bm = result.scalar_one_or_none()
    if not bm:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    await db.delete(bm)
    await db.commit()
    return {"message": "Bookmark removed successfully", "id": bookmark_id}
