# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-12-19

### Added
- **Serialization Support**: Complete tree state serialization and deserialization
  - `serialize()` method to convert tree state to JSON-compatible format
  - `deserialize(data, poseidon)` static method to restore tree from serialized data
  - Proper handling of bigint values in JSON serialization
- **File I/O Operations**: 
  - `saveToFile(filePath)` method to persist tree state to disk
  - `loadFromFile(filePath, poseidon?)` static method to load tree from file
  - Automatic directory creation for file operations
- **Enhanced API Methods**:
  - `getLeaves()` method to retrieve all tree leaves
  - `getNodesAtLevel(level)` method for tree introspection
  - `size` getter property for leaf count
- **Comprehensive Test Suite**: 
  - 24 comprehensive end-to-end tests
  - Coverage for all core functionality
  - Serialization/deserialization testing
  - Error condition testing
  - Integration workflow testing
- **Type Definitions**: Added TypeScript declarations for circomlibjs
- **Documentation**: 
  - Comprehensive README with API documentation
  - Basic usage examples with detailed explanations
  - Advanced usage patterns and examples

### Fixed
- **Poseidon Hash Handling**: Proper conversion of Poseidon output to bigint
  - Added `toField()` method to handle Uint8Array and Array outputs
  - Fixed root calculation and hash operations
- **Predecessor Index Logic**: Fixed predecessor finding algorithm
  - Changed from binary search to linear search for correct value-based ordering
  - Ensures proper linked list traversal for non-membership proofs
- **Tree Initialization**: Proper zero value calculation and tree setup
  - Fixed constructor to properly initialize zero values using Poseidon
  - Correct initial tree state with sentinel leaf
- **Proof Verification**: Enhanced verification logic
  - Correct handling of edge cases in non-membership proof validation
  - Proper range checking for predecessor relationships

### Changed
- **Tree Structure**: Improved linked list maintenance during insertions
  - Better handling of out-of-order insertions
  - Correct next pointer updates for sorted ordering
- **Error Handling**: Enhanced error messages and validation
  - Better error context for debugging
  - Proper error types for different failure modes
- **Performance**: Optimized tree operations
  - Efficient sparse tree representation
  - O(log n) complexity for core operations

## [1.0.0] - 2024-12-19

### Added
- **Core Indexed Merkle Tree Implementation**:
  - Basic tree structure with 32-level depth
  - Poseidon hash function integration
  - Linked list ordering of leaves for range proofs
- **Non-Membership Proof System**:
  - `createNonMembershipProof(query)` method
  - `verifyNonMembershipProof(proof)` method
  - Cryptographically secure proof generation and verification
- **Basic Tree Operations**:
  - `insert(value)` method for adding values
  - Automatic tree balancing and hash updates
  - Duplicate value prevention
- **TypeScript Support**:
  - Full type definitions for all interfaces
  - `Leaf`, `NonMembershipProof`, and core type exports
- **Build System**:
  - TypeScript compilation setup
  - Jest testing framework configuration
  - ESLint code quality checks
- **Package Configuration**:
  - NPM package setup with proper metadata
  - Peer dependency on circomlibjs
  - MIT license and repository information

### Technical Details
- **Hash Function**: Poseidon hash designed for zero-knowledge applications
- **Tree Depth**: Fixed 32 levels providing 2^32 capacity
- **Security**: Cryptographically sound non-membership proofs
- **Performance**: Logarithmic time complexity for all operations

---

## Version History Summary

- **v1.0.1**: Added serialization, file I/O, comprehensive testing, and fixed core algorithms
- **v1.0.0**: Initial release with core Indexed Merkle Tree functionality

## Migration Guide

### From v1.0.0 to v1.0.1

No breaking changes. All existing code will continue to work. New features added:

```javascript
// New serialization features
const serialized = tree.serialize();
const newTree = IndexedMerkleTree.deserialize(serialized, poseidon);

// New file operations
await tree.saveToFile('./tree.json');
const loadedTree = await IndexedMerkleTree.loadFromFile('./tree.json');

// New utility methods
const leaves = tree.getLeaves();
const levelNodes = tree.getNodesAtLevel(0);
const size = tree.size;
```

## Upcoming Features

Future releases may include:
- Batch insertion operations
- Memory-optimized tree variants
- Integration helpers for zk-SNARK circuits
- Performance optimizations for large datasets
- Additional hash function support

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## Support

For questions, bug reports, or feature requests, please:
- Open an issue on [GitHub](https://github.com/jayanth-kumar-morem/indexed-merkle-tree/issues)
- Check existing documentation and examples
- Review the test suite for usage patterns
