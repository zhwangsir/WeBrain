"""
Test in-memory ANN vector index (numpy + sklearn).
"""
import pytest
import numpy as np
import tempfile
import os
import json

from main_brain.memory.memory_manager import MemoryManager


@pytest.fixture
def mm():
    db_path = tempfile.mktemp(suffix=".db")
    m = MemoryManager(db_path=db_path, llm_config={})
    yield m
    os.unlink(db_path)


class TestVectorIndex:
    def test_index_loads_from_db(self, mm):
        """Vectors stored in DB should be loaded into memory index."""
        with mm._connect() as conn:
            for i in range(5):
                mem_id = f"mem-{i}"
                conn.execute(
                    "INSERT INTO memories (id, level, content, created_at) VALUES (?, ?, ?, ?)",
                    (mem_id, "L2", f"text {i}", "2024-01-01T00:00:00"),
                )
                vec = np.zeros(384, dtype=np.float32)
                vec[i] = 1.0
                conn.execute(
                    "INSERT INTO vectors (id, memory_id, vector, vector_blob, dim, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (f"vec-{i}", mem_id, json.dumps(vec.tolist()), vec.tobytes(), 384, "2024-01-01T00:00:00"),
                )
            conn.commit()

        mm._load_vector_index()
        assert len(mm._vector_ids) == 5
        assert mm._vector_matrix.shape == (5, 384)

    def test_add_to_index(self, mm):
        """Adding vectors should update the index."""
        mm._add_to_index("mem-1", [0.1, 0.2, 0.3])
        mm._add_to_index("mem-2", [0.4, 0.5, 0.6])
        assert len(mm._vector_ids) == 2
        assert mm._vector_matrix.shape == (2, 3)

    def test_cosine_similarity(self, mm):
        """Cosine similarity should be 1.0 for identical vectors."""
        v1 = [1.0, 0.0, 0.0]
        v2 = [1.0, 0.0, 0.0]
        assert mm._cosine_similarity(v1, v2) == pytest.approx(1.0)

    def test_cosine_similarity_orthogonal(self, mm):
        """Orthogonal vectors should have 0 similarity."""
        v1 = [1.0, 0.0]
        v2 = [0.0, 1.0]
        assert mm._cosine_similarity(v1, v2) == pytest.approx(0.0)

    def test_blob_storage(self, mm):
        """Vector BLOB should round-trip correctly."""
        vec = np.array([0.1, 0.2, 0.3, 0.4], dtype=np.float32)
        blob = vec.tobytes()
        recovered = np.frombuffer(blob, dtype=np.float32)
        np.testing.assert_array_equal(vec, recovered)
