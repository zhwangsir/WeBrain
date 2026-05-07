"""
CJK FTS5 Tokenizer Helper
为 SQLite FTS5 提供中文/日文/韩文 trigram 分词支持
参考 Hermes 的 FTS5 trigram tokenizer 实现
"""

import re
from typing import List

# CJK Unicode ranges
CJK_RANGES = [
    (0x4E00, 0x9FFF),   # CJK Unified Ideographs
    (0x3400, 0x4DBF),   # CJK Extension A
    (0x20000, 0x2A6DF), # CJK Extension B
    (0x2A700, 0x2B73F), # CJK Extension C
    (0x2B740, 0x2B81F), # CJK Extension D
    (0xF900, 0xFAFF),   # CJK Compatibility Ideographs
    (0x3000, 0x303F),   # CJK Symbols and Punctuation
    (0x3040, 0x309F),   # Hiragana
    (0x30A0, 0x30FF),   # Katakana
    (0xAC00, 0xD7AF),   # Hangul Syllables
    (0xFF00, 0xFFEF),   # Fullwidth forms
]


def is_cjk_char(char: str) -> bool:
    """Check if a character is CJK."""
    if len(char) != 1:
        return False
    code = ord(char)
    for start, end in CJK_RANGES:
        if start <= code <= end:
            return True
    return False


def has_cjk(text: str) -> bool:
    """Check if text contains any CJK characters."""
    return any(is_cjk_char(c) for c in text)


def trigram_tokenize(text: str) -> List[str]:
    """
    Tokenize text into trigrams for CJK-friendly FTS5 search.
    For Latin text: split by whitespace and punctuation.
    For CJK text: generate overlapping 2-3 character n-grams.
    """
    tokens: List[str] = []

    if not text:
        return tokens

    # Split into CJK and non-CJK segments
    segments = _split_segments(text)

    for segment, is_cjk in segments:
        if is_cjk:
            # Generate n-grams for CJK (2-grams for short, 3-grams for longer)
            seg_len = len(segment)
            if seg_len <= 2:
                tokens.append(segment)
            else:
                n = 3 if seg_len >= 3 else 2
                for i in range(seg_len - n + 1):
                    tokens.append(segment[i:i + n])
        else:
            # For Latin text, split by whitespace and normalize
            for word in re.findall(r"[a-zA-Z0-9_]+", segment.lower()):
                if len(word) > 1:
                    tokens.append(word)

    return tokens


def _split_segments(text: str) -> List[tuple]:
    """Split text into (segment, is_cjk) tuples."""
    segments: List[tuple] = []
    if not text:
        return segments

    current = text[0]
    is_cjk = is_cjk_char(text[0])

    for char in text[1:]:
        char_is_cjk = is_cjk_char(char)
        if char_is_cjk == is_cjk:
            current += char
        else:
            segments.append((current, is_cjk))
            current = char
            is_cjk = char_is_cjk

    segments.append((current, is_cjk))
    return segments


def build_fts_query(query: str) -> str:
    """
    Build an FTS5 query string from user input.
    For CJK queries: tokenize and join with OR for broad match, AND for narrow.
    """
    tokens = trigram_tokenize(query)
    if not tokens:
        return query

    # For short queries (1-2 tokens), use OR for recall
    # For longer queries, group adjacent tokens with NEAR
    if len(tokens) <= 2:
        return " OR ".join(tokens)

    # Group into phrases for better precision
    phrases = []
    cjk_tokens = [t for t in tokens if any(is_cjk_char(c) for c in t)]
    latin_tokens = [t for t in tokens if not any(is_cjk_char(c) for c in t)]

    if cjk_tokens:
        phrases.append(" OR ".join(cjk_tokens))
    if latin_tokens:
        phrases.append(" OR ".join(latin_tokens))

    return " AND ".join(f"({p})" for p in phrases)


def highlight_matches(text: str, query: str) -> str:
    """Simple highlight of query terms in text (for display purposes)."""
    tokens = trigram_tokenize(query)
    result = text
    for token in sorted(tokens, key=len, reverse=True):
        if len(token) < 2:
            continue
        pattern = re.compile(re.escape(token), re.IGNORECASE)
        result = pattern.sub(f"**{token}**", result)
    return result
