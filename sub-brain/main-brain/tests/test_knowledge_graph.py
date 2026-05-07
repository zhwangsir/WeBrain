"""Tests for KnowledgeGraph engine."""

import pytest

from memory.knowledge_graph import KnowledgeGraph


class TestKnowledgeGraph:
    """Unit tests for KnowledgeGraph."""

    @pytest.fixture
    def kg(self, temp_dir, mock_llm_config):
        """Fresh KnowledgeGraph instance."""
        db_path = temp_dir / "test_kg.db"
        return KnowledgeGraph(db_path=str(db_path), llm_config=mock_llm_config)

    def test_add_entity(self, kg):
        eid = kg.add_entity("Alice", "person", "A test person", {"age": "30"})
        assert eid == "alice"
        entity = kg.get_entity(eid)
        assert entity["name"] == "Alice"
        assert entity["type"] == "person"
        assert entity["properties"]["age"] == "30"

    def test_add_relation(self, kg):
        alice = kg.add_entity("Alice", "person")
        bob = kg.add_entity("Bob", "person")
        rid = kg.add_relation(alice, bob, "knows", {"since": "2020"})
        assert rid.startswith("rel-")

        rels = kg.get_relations(alice)
        assert len(rels) == 1
        assert rels[0]["type"] == "knows"
        assert rels[0]["target"] == bob

    def test_find_entity_case_insensitive(self, kg):
        kg.add_entity("Alice", "person")
        found = kg.find_entity("alice")
        assert found is not None
        assert found["name"] == "Alice"

    def test_search(self, kg):
        kg.add_entity("Python", "technology", "A programming language")
        kg.add_entity("JavaScript", "technology", "Web programming language")
        kg.add_entity("Alice", "person", "A person who codes in Python")

        results = kg.search("Python", limit=5)
        assert len(results) >= 2
        names = [r["name"] for r in results]
        assert "Python" in names

    def test_neighbors(self, kg):
        alice = kg.add_entity("Alice", "person")
        bob = kg.add_entity("Bob", "person")
        carol = kg.add_entity("Carol", "person")
        kg.add_relation(alice, bob, "knows")
        kg.add_relation(alice, carol, "works_with")

        neighbors = kg.get_neighbors(alice)
        assert len(neighbors) == 2

        # Filter by relation type
        knows_only = kg.get_neighbors(alice, relation_type="knows")
        assert len(knows_only) == 1
        assert knows_only[0]["name"] == "Bob"

    def test_find_path(self, kg):
        a = kg.add_entity("A", "concept")
        b = kg.add_entity("B", "concept")
        c = kg.add_entity("C", "concept")
        kg.add_relation(a, b, "links")
        kg.add_relation(b, c, "links")

        path = kg.find_path(a, c, max_depth=5)
        assert path is not None
        assert len(path) == 2  # A->B, B->C

    def test_find_path_no_path(self, kg):
        a = kg.add_entity("A", "concept")
        b = kg.add_entity("B", "concept")
        # No relation
        path = kg.find_path(a, b, max_depth=5)
        assert path is None

    def test_delete_entity_cascades_relations(self, kg):
        a = kg.add_entity("A", "concept")
        b = kg.add_entity("B", "concept")
        kg.add_relation(a, b, "links")

        assert len(kg.get_relations(a)) == 1
        kg.delete_entity(a)
        assert kg.get_entity(a) is None
        assert len(kg.get_relations(b)) == 0  # Relation deleted

    def test_stats(self, kg):
        kg.add_entity("A", "concept")
        kg.add_entity("B", "person")
        kg.add_relation("a", "b", "links")
        stats = kg.get_stats()
        assert stats["entity_count"] == 2
        assert stats["relation_count"] == 1
        assert "concept" in stats["entity_types"]
        assert "person" in stats["entity_types"]

    def test_list_entities_filter(self, kg):
        kg.add_entity("Alice", "person")
        kg.add_entity("Python", "technology")
        people = kg.list_entities(entity_type="person")
        assert len(people) == 1
        assert people[0]["name"] == "Alice"

    def test_subgraph(self, kg):
        center = kg.add_entity("Center", "concept")
        n1 = kg.add_entity("N1", "concept")
        n2 = kg.add_entity("N2", "concept")
        distant = kg.add_entity("Distant", "concept")
        kg.add_relation(center, n1, "links")
        kg.add_relation(center, n2, "links")
        kg.add_relation(n1, distant, "links")

        sg = kg.get_subgraph(center, depth=1)
        assert len(sg["entities"]) == 3  # center + n1 + n2
        assert len(sg["relations"]) == 2

        sg2 = kg.get_subgraph(center, depth=2)
        assert len(sg2["entities"]) == 4  # includes distant
