"""Comparable selection shared by valuation and rental-yield.

Works on any record with `.size_sqm` and `.bedrooms` (sale Transaction or
RentContract), so both endpoints pick comparables the same way.
"""
from typing import Protocol, TypeVar

SIZE_TOLERANCE = 0.35  # a "comparable" is within ±35% of the subject floor area
MIN_COMPS = 5          # below this, the size filter isn't trustworthy — widen


class _Sized(Protocol):
    size_sqm: float
    bedrooms: int | None


T = TypeVar("T", bound=_Sized)


def select_by_size(records: list[T], size_sqm: float, bedrooms: int | None = None) -> tuple[list[T], bool]:
    """Return (comparables, narrowed). `narrowed` is False when too few
    size-matched records existed and we fell back to the full set."""
    lo, hi = size_sqm * (1 - SIZE_TOLERANCE), size_sqm * (1 + SIZE_TOLERANCE)
    sized = [r for r in records if lo <= r.size_sqm <= hi]

    if bedrooms is not None:
        by_bed = [r for r in sized if r.bedrooms == bedrooms]
        if len(by_bed) >= MIN_COMPS:
            sized = by_bed

    if len(sized) >= MIN_COMPS:
        return sized, True
    return records, False
