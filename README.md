# Indexed Merkle Tree

[![npm version](https://badge.fury.io/js/@jayanth-kumar-morem%2Findexed-merkle-tree.svg)](https://badge.fury.io/js/@jayanth-kumar-morem%2Findexed-merkle-tree)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript implementation of Indexed Merkle Trees with Poseidon hash function support for generating and verifying non-membership proofs. This library provides an efficient way to prove that a value does not exist in a set using cryptographic proofs.

## Features

- 🌳 **Indexed Merkle Tree**: Efficient tree structure for membership/non-membership proofs
- 🔐 **Poseidon Hash**: Uses Poseidon hash function for cryptographic security
- 📦 **Serialization**: Complete state serialization/deserialization support
- 💾 **File I/O**: Save and load tree states to/from files
- ✅ **Type Safe**: Full TypeScript support with comprehensive type definitions
- 🧪 **Well Tested**: Comprehensive test suite with 100% functionality coverage
- 🚀 **Zero Dependencies**: Only requires circomlibjs for Poseidon hashing

## Installation

```bash
npm install @jayanth-kumar-morem/indexed-merkle-tree circomlibjs
```

## Quick Start

```javascript
import { IndexedMerkleTree } from '@jayanth-kumar-morem/indexed-merkle-tree';
import { buildPoseidon } from 'circomlibjs';

async function example() {
    // Initialize Poseidon hash function
    const poseidon = await buildPoseidon();
    
    // Create a new Indexed Merkle Tree
    const tree = new IndexedMerkleTree(poseidon);
    
    // Insert values
    await tree.insert(100n);
    await tree.insert(200n);
    await tree.insert(150n);
    
    // Generate a non-membership proof for value 175
    const proof = tree.createNonMembershipProof(175n);
    
    // Verify the proof
    const isValid = tree.verifyNonMembershipProof(proof);
    console.log('Proof is valid:', isValid); // true
    
    // Save tree state
    await tree.saveToFile('./tree-state.json');
    
    // Load tree state
    const loadedTree = await IndexedMerkleTree.loadFromFile('./tree-state.json');
}

example().catch(console.error);
```

## API Reference

### Class: IndexedMerkleTree

#### Constructor

```typescript
constructor(poseidon: any)
```

Creates a new Indexed Merkle Tree instance.

**Parameters:**
- `poseidon`: Poseidon hash function instance from circomlibjs

#### Properties

- `depth: number` - Tree depth (readonly, always 32)
- `size: number` - Number of leaves in the tree
- `root: bigint` - Current root hash of the tree

#### Methods

##### `async insert(value: bigint): Promise<void>`

Inserts a new value into the tree.

**Parameters:**
- `value`: The bigint value to insert

**Throws:**
- Error if the value already exists in the tree

##### `createNonMembershipProof(query: bigint): NonMembershipProof`

Creates a non-membership proof for a given value.

**Parameters:**
- `query`: The bigint value to prove non-membership for

**Returns:**
- `NonMembershipProof` object containing proof data

**Throws:**
- Error if no predecessor is found (empty tree)

##### `verifyNonMembershipProof(proof: NonMembershipProof): boolean`

Verifies a non-membership proof.

**Parameters:**
- `proof`: The proof object to verify

**Returns:**
- `true` if proof is valid, `false` otherwise

##### `serialize(): SerializedIMT`

Serializes the tree state to a JSON-compatible object.

**Returns:**
- `SerializedIMT` object with string representations of bigint values

##### `static deserialize(data: SerializedIMT, poseidon: any): IndexedMerkleTree`

Deserializes a tree state from a JSON-compatible object.

**Parameters:**
- `data`: Serialized tree data
- `poseidon`: Poseidon hash function instance

**Returns:**
- New `IndexedMerkleTree` instance with restored state

##### `async saveToFile(filePath: string): Promise<void>`

Saves the tree state to a JSON file.

**Parameters:**
- `filePath`: Path where to save the file (directories will be created if needed)

##### `static async loadFromFile(filePath: string, poseidon?: any): Promise<IndexedMerkleTree>`

Loads a tree state from a JSON file.

**Parameters:**
- `filePath`: Path to the file to load
- `poseidon`: Optional Poseidon instance (will be built if not provided)

**Returns:**
- New `IndexedMerkleTree` instance with loaded state

##### `getLeaves(): Leaf[]`

Returns a copy of all leaves in the tree.

**Returns:**
- Array of `Leaf` objects

##### `getNodesAtLevel(level: number): bigint[]`

Returns all nodes at a specific tree level.

**Parameters:**
- `level`: Tree level (0 = leaves, increasing towards root)

**Returns:**
- Array of bigint node values

**Throws:**
- Error if level is invalid

### Interfaces

#### Leaf

```typescript
interface Leaf {
    val: bigint;      // The leaf value
    nextVal: bigint;  // Next value in sorted order (0n if last)
    nextIdx: number;  // Index of next leaf
}
```

#### NonMembershipProof

```typescript
interface NonMembershipProof {
    query: bigint;       // The value being proved absent
    preLeaf: Leaf;       // The predecessor leaf
    path: bigint[];      // Merkle path (sibling hashes)
    directions: number[]; // Path directions (0 = left, 1 = right)
    root: bigint;        // Tree root at time of proof
}
```

#### SerializedIMT

```typescript
interface SerializedIMT {
    depth: number;
    nodes: string[][];    // String representations of bigint values
    leaves: {
        val: string;      // String representation of bigint
        nextVal: string;  // String representation of bigint
        nextIdx: number;
    }[];
}
```

## Use Cases

### Privacy-Preserving Applications
- Prove you're not in a blocklist without revealing your identity
- Demonstrate absence from a database without exposing the data

### Zero-Knowledge Proofs
- Integration with zk-SNARK circuits for scalable privacy
- Batch verification of multiple non-membership claims

### Blockchain Applications
- Efficient state exclusion proofs
- Privacy-preserving transaction validation

## Advanced Usage

### Working with Large Values

```javascript
const largeValue = BigInt('0x' + 'f'.repeat(64)); // 32-byte value
await tree.insert(largeValue);

const proof = tree.createNonMembershipProof(largeValue - 1n);
const isValid = tree.verifyNonMembershipProof(proof);
```

### Batch Operations

```javascript
const values = [100n, 200n, 300n, 150n, 250n];

// Insert multiple values
for (const value of values) {
    await tree.insert(value);
}

// Generate multiple proofs
const queries = [125n, 175n, 275n, 400n];
const proofs = queries.map(q => tree.createNonMembershipProof(q));

// Verify all proofs
const results = proofs.map(proof => tree.verifyNonMembershipProof(proof));
console.log('All proofs valid:', results.every(r => r));
```

### State Persistence

```javascript
// Save tree state
await tree.saveToFile('./data/tree-backup.json');

// Load and continue working
const restoredTree = await IndexedMerkleTree.loadFromFile('./data/tree-backup.json');
await restoredTree.insert(999n);

// Verify proofs still work
const proof = restoredTree.createNonMembershipProof(500n);
const isValid = restoredTree.verifyNonMembershipProof(proof);
```

## Performance

- **Tree Depth**: Fixed at 32 levels for optimal balance of security and performance
- **Insertion**: O(log n) time complexity
- **Proof Generation**: O(log n) time complexity  
- **Proof Verification**: O(log n) time complexity
- **Memory Usage**: Efficient sparse tree representation

## Security Considerations

- Uses Poseidon hash function designed for zero-knowledge applications
- 32-level tree provides 2^32 capacity with strong security guarantees
- All operations are deterministic and verifiable
- Proofs are cryptographically sound and cannot be forged

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

```bash
git clone https://github.com/jayanth-kumar-morem/indexed-merkle-tree.git
cd indexed-merkle-tree
npm install
npm run build
npm test
```

### Running Tests

```bash
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Jayanth Kumar**
- Email: jayanthkumar1903@gmail.com
- GitHub: [@jayanth-kumar-morem](https://github.com/jayanth-kumar-morem)

## Acknowledgments

- Built with [circomlibjs](https://github.com/iden3/circomlibjs) for Poseidon hashing
- Inspired by the indexed Merkle tree research in zero-knowledge cryptography

---

For more examples and detailed documentation, visit the [GitHub repository](https://github.com/jayanth-kumar-morem/indexed-merkle-tree).
