import { IndexedMerkleTree, Leaf, NonMembershipProof, SerializedIMT } from '../src/index';
import { buildPoseidon } from 'circomlibjs';
import * as fs from 'fs';
import * as path from 'path';

describe('IndexedMerkleTree', () => {
    let tree: IndexedMerkleTree;
    let poseidon: any;
    const testDir = path.join(__dirname, 'temp');

    beforeAll(async () => {
        poseidon = await buildPoseidon();
    });

    beforeEach(async () => {
        tree = new IndexedMerkleTree(poseidon);
    });

    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Basic Functionality', () => {
        test('should initialize with empty tree', () => {
            expect(tree.size).toBe(1); // Contains the initial empty leaf
            expect(tree.root).toBeDefined();
            expect(typeof tree.root).toBe('bigint');
        });

        test('should insert single value', async () => {
            const value = 42n;
            await tree.insert(value);
            
            expect(tree.size).toBe(2); // Initial leaf + new leaf
            const leaves = tree.getLeaves();
            expect(leaves.some(leaf => leaf.val === value)).toBe(true);
        });

        test('should insert multiple values in order', async () => {
            const values = [10n, 20n, 30n, 40n, 50n];
            
            for (const value of values) {
                await tree.insert(value);
            }
            
            expect(tree.size).toBe(values.length + 1); // +1 for initial leaf
            const leaves = tree.getLeaves();
            
            for (const value of values) {
                expect(leaves.some(leaf => leaf.val === value)).toBe(true);
            }
        });

        test('should insert values in random order', async () => {
            const values = [50n, 10n, 30n, 20n, 40n];
            
            for (const value of values) {
                await tree.insert(value);
            }
            
            expect(tree.size).toBe(values.length + 1);
            const leaves = tree.getLeaves();
            
            for (const value of values) {
                expect(leaves.some(leaf => leaf.val === value)).toBe(true);
            }
        });

        test('should prevent duplicate insertions', async () => {
            const value = 42n;
            await tree.insert(value);
            
            await expect(tree.insert(value)).rejects.toThrow('already exists');
        });

        test('should maintain linked list structure', async () => {
            const values = [10n, 30n, 20n]; // Insert out of order
            
            for (const value of values) {
                await tree.insert(value);
            }
            
            const leaves = tree.getLeaves();
            // Check that the linked list is properly maintained
            // First leaf should be 0 (initial) -> 10 -> 20 -> 30
            const leaf0 = leaves.find(l => l.val === 0n);
            const leaf10 = leaves.find(l => l.val === 10n);
            const leaf20 = leaves.find(l => l.val === 20n);
            const leaf30 = leaves.find(l => l.val === 30n);
            
            expect(leaf0?.nextVal).toBe(10n);
            expect(leaf10?.nextVal).toBe(20n);
            expect(leaf20?.nextVal).toBe(30n);
            expect(leaf30?.nextVal).toBe(0n);
        });
    });

    describe('Non-Membership Proofs', () => {
        beforeEach(async () => {
            // Setup tree with some values
            const values = [10n, 30n, 50n];
            for (const value of values) {
                await tree.insert(value);
            }
        });

        test('should create valid non-membership proof for value between leaves', () => {
            const queryValue = 25n; // Between 10 and 30
            const proof = tree.createNonMembershipProof(queryValue);
            
            expect(proof.query).toBe(queryValue);
            expect(proof.preLeaf.val).toBe(10n);
            expect(proof.preLeaf.nextVal).toBe(30n);
            expect(proof.path).toHaveLength(tree.depth);
            expect(proof.directions).toHaveLength(tree.depth);
            expect(proof.root).toBe(tree.root);
        });

        test('should create valid non-membership proof for value less than all leaves', () => {
            const queryValue = 5n; // Less than all inserted values
            const proof = tree.createNonMembershipProof(queryValue);
            
            expect(proof.query).toBe(queryValue);
            expect(proof.preLeaf.val).toBe(0n);
            expect(proof.preLeaf.nextVal).toBe(10n);
        });

        test('should create valid non-membership proof for value greater than all leaves', () => {
            const queryValue = 100n; // Greater than all inserted values
            const proof = tree.createNonMembershipProof(queryValue);
            
            expect(proof.query).toBe(queryValue);
            expect(proof.preLeaf.val).toBe(50n);
            expect(proof.preLeaf.nextVal).toBe(0n);
        });

        test('should verify valid non-membership proofs', () => {
            const testValues = [5n, 25n, 45n, 100n];
            
            for (const queryValue of testValues) {
                const proof = tree.createNonMembershipProof(queryValue);
                const isValid = tree.verifyNonMembershipProof(proof);
                expect(isValid).toBe(true);
            }
        });

        test('should reject invalid proofs with wrong root', () => {
            const queryValue = 25n;
            const proof = tree.createNonMembershipProof(queryValue);
            proof.root = 12345n; // Invalid root
            
            const isValid = tree.verifyNonMembershipProof(proof);
            expect(isValid).toBe(false);
        });

        test('should reject invalid proofs with wrong predecessor', () => {
            const queryValue = 25n;
            const proof = tree.createNonMembershipProof(queryValue);
            proof.preLeaf.val = 35n; // Wrong predecessor (should be 10, not 35)
            
            const isValid = tree.verifyNonMembershipProof(proof);
            expect(isValid).toBe(false);
        });

        test('should reject proofs for existing values', async () => {
            const existingValue = 30n;
            const proof = tree.createNonMembershipProof(existingValue);
            
            // The proof should be invalid because 30 exists
            const isValid = tree.verifyNonMembershipProof(proof);
            expect(isValid).toBe(false);
        });
    });

    describe('Serialization and Deserialization', () => {
        beforeEach(async () => {
            // Setup tree with some values
            const values = [15n, 45n, 25n, 35n];
            for (const value of values) {
                await tree.insert(value);
            }
        });

        test('should serialize tree state', () => {
            const serialized = tree.serialize();
            
            expect(serialized.depth).toBe(tree.depth);
            expect(serialized.nodes).toBeInstanceOf(Array);
            expect(serialized.leaves).toBeInstanceOf(Array);
            expect(serialized.leaves).toHaveLength(tree.size);
            
            // Check that bigints are serialized as strings
            expect(typeof serialized.leaves[0].val).toBe('string');
            expect(typeof serialized.leaves[0].nextVal).toBe('string');
        });

        test('should deserialize tree state', () => {
            const serialized = tree.serialize();
            const deserializedTree = IndexedMerkleTree.deserialize(serialized, poseidon);
            
            expect(deserializedTree.size).toBe(tree.size);
            expect(deserializedTree.root).toBe(tree.root);
            
            const originalLeaves = tree.getLeaves();
            const deserializedLeaves = deserializedTree.getLeaves();
            
            expect(deserializedLeaves).toHaveLength(originalLeaves.length);
            
            for (let i = 0; i < originalLeaves.length; i++) {
                expect(deserializedLeaves[i].val).toBe(originalLeaves[i].val);
                expect(deserializedLeaves[i].nextVal).toBe(originalLeaves[i].nextVal);
                expect(deserializedLeaves[i].nextIdx).toBe(originalLeaves[i].nextIdx);
            }
        });

        test('should maintain proof verification after deserialization', () => {
            const queryValue = 20n;
            const originalProof = tree.createNonMembershipProof(queryValue);
            
            const serialized = tree.serialize();
            const deserializedTree = IndexedMerkleTree.deserialize(serialized, poseidon);
            
            const deserializedProof = deserializedTree.createNonMembershipProof(queryValue);
            
            expect(deserializedTree.verifyNonMembershipProof(originalProof)).toBe(true);
            expect(tree.verifyNonMembershipProof(deserializedProof)).toBe(true);
        });

        test('should save tree to file', async () => {
            const filePath = path.join(testDir, 'tree.json');
            
            await tree.saveToFile(filePath);
            
            expect(fs.existsSync(filePath)).toBe(true);
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(fileContent);
            
            expect(parsed.depth).toBe(tree.depth);
            expect(parsed.leaves).toHaveLength(tree.size);
        });

        test('should load tree from file', async () => {
            const filePath = path.join(testDir, 'tree.json');
            
            await tree.saveToFile(filePath);
            const loadedTree = await IndexedMerkleTree.loadFromFile(filePath, poseidon);
            
            expect(loadedTree.size).toBe(tree.size);
            expect(loadedTree.root).toBe(tree.root);
            
            // Test that functionality is preserved
            const queryValue = 20n;
            const originalProof = tree.createNonMembershipProof(queryValue);
            const loadedProof = loadedTree.createNonMembershipProof(queryValue);
            
            expect(loadedTree.verifyNonMembershipProof(originalProof)).toBe(true);
            expect(tree.verifyNonMembershipProof(loadedProof)).toBe(true);
        });

        test('should handle non-existent file gracefully', async () => {
            const filePath = path.join(testDir, 'nonexistent.json');
            
            await expect(IndexedMerkleTree.loadFromFile(filePath)).rejects.toThrow('File not found');
        });

        test('should create directory if it does not exist', async () => {
            const deepPath = path.join(testDir, 'nested', 'deep', 'tree.json');
            
            await tree.saveToFile(deepPath);
            
            expect(fs.existsSync(deepPath)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('should handle large values', async () => {
            const largeValue = BigInt('0x' + 'f'.repeat(64)); // 32-byte value
            
            await tree.insert(largeValue);
            expect(tree.size).toBe(2);
            
            const proof = tree.createNonMembershipProof(largeValue - 1n);
            expect(tree.verifyNonMembershipProof(proof)).toBe(true);
        });

        test('should handle many insertions efficiently', async () => {
            const numInsertions = 100;
            const values: bigint[] = [];
            
            for (let i = 0; i < numInsertions; i++) {
                values.push(BigInt(i * 10 + 5));
            }
            
            // Shuffle values to insert in random order
            for (let i = values.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [values[i], values[j]] = [values[j], values[i]];
            }
            
            for (const value of values) {
                await tree.insert(value);
            }
            
            expect(tree.size).toBe(numInsertions + 1);
            
            // Test a few proofs
            for (let i = 0; i < 10; i++) {
                const queryValue = BigInt(i * 10 + 2); // Non-existent values
                const proof = tree.createNonMembershipProof(queryValue);
                expect(tree.verifyNonMembershipProof(proof)).toBe(true);
            }
        });

        test('should get nodes at specific levels', () => {
            const level0Nodes = tree.getNodesAtLevel(0);
            expect(level0Nodes).toBeInstanceOf(Array);
            
            expect(() => tree.getNodesAtLevel(-1)).toThrow('Invalid level');
            expect(() => tree.getNodesAtLevel(tree.depth + 1)).toThrow('Invalid level');
        });
    });

    describe('Integration Tests', () => {
        test('complete workflow: insert, prove, serialize, deserialize, prove again', async () => {
            // Insert values
            const values = [100n, 200n, 150n, 300n, 50n];
            for (const value of values) {
                await tree.insert(value);
            }
            
            // Create and verify proof
            const queryValue = 175n;
            const originalProof = tree.createNonMembershipProof(queryValue);
            expect(tree.verifyNonMembershipProof(originalProof)).toBe(true);
            
            // Serialize to string
            const serialized = tree.serialize();
            const jsonString = JSON.stringify(serialized);
            
            // Deserialize from string
            const parsed = JSON.parse(jsonString);
            const restoredTree = IndexedMerkleTree.deserialize(parsed, poseidon);
            
            // Verify proof still works
            expect(restoredTree.verifyNonMembershipProof(originalProof)).toBe(true);
            
            // Create new proof and verify
            const newProof = restoredTree.createNonMembershipProof(queryValue);
            expect(restoredTree.verifyNonMembershipProof(newProof)).toBe(true);
            expect(tree.verifyNonMembershipProof(newProof)).toBe(true);
            
            // Insert more values in restored tree
            await restoredTree.insert(175n);
            expect(restoredTree.size).toBe(tree.size + 1);
            
            // Now the proof should be invalid (value exists)
            const newInvalidProof = restoredTree.createNonMembershipProof(175n);
            expect(restoredTree.verifyNonMembershipProof(newInvalidProof)).toBe(false);
        });
    });
});
