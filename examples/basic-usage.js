/**
 * Basic Usage Example for Indexed Merkle Tree
 * 
 * This example demonstrates:
 * - Creating an Indexed Merkle Tree
 * - Inserting values
 * - Creating and verifying non-membership proofs
 * - Serialization and file operations
 * - Error handling
 */

// For local testing, use the built files
const { IndexedMerkleTree } = require('../dist/index.js');
const { buildPoseidon } = require('circomlibjs');

// For npm package usage, uncomment the line below:
// const { IndexedMerkleTree } = require('@jayanth-kumar-morem/indexed-merkle-tree');

async function basicUsageExample() {
    console.log('🌳 Indexed Merkle Tree - Basic Usage Example\n');
    
    try {
        // Step 1: Initialize Poseidon hash function
        console.log('1. Initializing Poseidon hash function...');
        const poseidon = await buildPoseidon();
        console.log('   ✅ Poseidon initialized\n');
        
        // Step 2: Create a new Indexed Merkle Tree
        console.log('2. Creating new Indexed Merkle Tree...');
        const tree = new IndexedMerkleTree(poseidon);
        console.log(`   ✅ Tree created with initial size: ${tree.size}`);
        console.log(`   📏 Tree depth: ${tree.depth}`);
        console.log(`   🔑 Initial root: ${tree.root.toString()}\n`);
        
        // Step 3: Insert some values
        console.log('3. Inserting values...');
        const valuesToInsert = [100n, 500n, 250n, 750n, 125n];
        
        for (const value of valuesToInsert) {
            await tree.insert(value);
            console.log(`   ➕ Inserted ${value}, tree size: ${tree.size}`);
        }
        console.log(`   🔑 Root after insertions: ${tree.root.toString()}\n`);
        
        // Step 4: Display tree structure
        console.log('4. Tree structure:');
        const leaves = tree.getLeaves();
        console.log('   Leaves (in insertion order):');
        leaves.forEach((leaf, idx) => {
            console.log(`   [${idx}] val: ${leaf.val}, nextVal: ${leaf.nextVal}, nextIdx: ${leaf.nextIdx}`);
        });
        
        // Show sorted order by following the linked list
        console.log('\n   Sorted order (following linked list):');
        let current = leaves.find(l => l.val === 0n); // Start from sentinel
        let sortedValues = [];
        while (current && current.nextVal !== 0n) {
            const next = leaves.find(l => l.val === current.nextVal);
            if (next) {
                sortedValues.push(next.val);
                current = next;
            } else {
                break;
            }
        }
        console.log(`   Sorted values: [${sortedValues.join(', ')}]\n`);
        
        // Step 5: Create and verify non-membership proofs
        console.log('5. Creating non-membership proofs...');
        const queriesToTest = [75n, 200n, 300n, 600n, 1000n];
        
        for (const query of queriesToTest) {
            try {
                const proof = tree.createNonMembershipProof(query);
                const isValid = tree.verifyNonMembershipProof(proof);
                
                console.log(`   🔍 Query: ${query}`);
                console.log(`      Predecessor: ${proof.preLeaf.val} → ${proof.preLeaf.nextVal}`);
                console.log(`      Proof valid: ${isValid ? '✅' : '❌'}`);
                
                // Explain why the proof is valid
                const inRange = proof.preLeaf.val < query && 
                              (proof.preLeaf.nextVal === 0n || query < proof.preLeaf.nextVal);
                console.log(`      In range [${proof.preLeaf.val}, ${proof.preLeaf.nextVal || '∞'}): ${inRange ? '✅' : '❌'}\n`);
                
            } catch (error) {
                console.log(`   ❌ Error creating proof for ${query}: ${error.message}\n`);
            }
        }
        
        // Step 6: Test duplicate insertion (should fail)
        console.log('6. Testing duplicate insertion...');
        try {
            await tree.insert(250n); // This value already exists
            console.log('   ❌ Duplicate insertion should have failed!');
        } catch (error) {
            console.log(`   ✅ Correctly rejected duplicate: ${error.message}\n`);
        }
        
        // Step 7: Serialization
        console.log('7. Serialization example...');
        const serialized = tree.serialize();
        console.log(`   📦 Serialized tree depth: ${serialized.depth}`);
        console.log(`   📦 Number of leaf entries: ${serialized.leaves.length}`);
        console.log(`   📦 Number of node levels: ${serialized.nodes.length}`);
        console.log('   ✅ Tree serialized successfully\n');
        
        // Step 8: Deserialization
        console.log('8. Deserialization example...');
        const deserializedTree = IndexedMerkleTree.deserialize(serialized, poseidon);
        console.log(`   📂 Deserialized tree size: ${deserializedTree.size}`);
        console.log(`   📂 Roots match: ${tree.root === deserializedTree.root ? '✅' : '❌'}`);
        
        // Verify a proof works on deserialized tree
        const testQuery = 300n;
        const originalProof = tree.createNonMembershipProof(testQuery);
        const deserializedProof = deserializedTree.createNonMembershipProof(testQuery);
        
        console.log(`   🔍 Original proof for ${testQuery} valid: ${tree.verifyNonMembershipProof(originalProof) ? '✅' : '❌'}`);
        console.log(`   🔍 Deserialized proof for ${testQuery} valid: ${deserializedTree.verifyNonMembershipProof(deserializedProof) ? '✅' : '❌'}`);
        console.log(`   🔍 Cross-verification works: ${tree.verifyNonMembershipProof(deserializedProof) ? '✅' : '❌'}\n`);
        
        // Step 9: File operations
        console.log('9. File operations example...');
        const filePath = './examples/tree-state.json';
        
        await tree.saveToFile(filePath);
        console.log(`   💾 Tree saved to ${filePath}`);
        
        const loadedTree = await IndexedMerkleTree.loadFromFile(filePath);
        console.log(`   📁 Tree loaded from ${filePath}`);
        console.log(`   📁 Loaded tree size: ${loadedTree.size}`);
        console.log(`   📁 Roots match: ${tree.root === loadedTree.root ? '✅' : '❌'}\n`);
        
        // Step 10: Performance test
        console.log('10. Performance test...');
        const startTime = Date.now();
        const numInsertions = 50;
        
        for (let i = 0; i < numInsertions; i++) {
            const value = BigInt(i * 37 + 13); // Generate pseudo-random values
            if (!tree.getLeaves().some(l => l.val === value)) {
                await tree.insert(value);
            }
        }
        
        const insertTime = Date.now() - startTime;
        console.log(`   ⚡ Inserted ${numInsertions} values in ${insertTime}ms`);
        console.log(`   ⚡ Average time per insertion: ${(insertTime / numInsertions).toFixed(2)}ms`);
        console.log(`   📊 Final tree size: ${tree.size}\n`);
        
        // Step 11: Large value test
        console.log('11. Large value test...');
        const largeValue = BigInt('0x' + 'f'.repeat(32)); // 128-bit value
        await tree.insert(largeValue);
        
        const largeProof = tree.createNonMembershipProof(largeValue - 1n);
        const largeProofValid = tree.verifyNonMembershipProof(largeProof);
        
        console.log(`   🔢 Inserted large value: ${largeValue.toString(16)}`);
        console.log(`   🔍 Proof for (large-1) valid: ${largeProofValid ? '✅' : '❌'}\n`);
        
        console.log('🎉 All examples completed successfully!');
        
    } catch (error) {
        console.error('❌ Example failed:', error);
        throw error;
    }
}

// Advanced usage example
async function advancedUsageExample() {
    console.log('\n🚀 Advanced Usage Example\n');
    
    const poseidon = await buildPoseidon();
    const tree = new IndexedMerkleTree(poseidon);
    
    // Batch insertion
    console.log('1. Batch insertion with random order...');
    const values = [1000n, 2000n, 1500n, 2500n, 1750n, 1250n];
    values.sort(() => Math.random() - 0.5); // Shuffle
    
    for (const value of values) {
        await tree.insert(value);
    }
    console.log(`   📊 Inserted ${values.length} values in random order\n`);
    
    // Batch proof generation and verification
    console.log('2. Batch proof verification...');
    const queries = [1100n, 1300n, 1600n, 1900n, 2200n, 3000n];
    const proofs = queries.map(q => tree.createNonMembershipProof(q));
    const validations = proofs.map(proof => tree.verifyNonMembershipProof(proof));
    
    queries.forEach((query, i) => {
        console.log(`   Query ${query}: ${validations[i] ? '✅' : '❌'}`);
    });
    
    const allValid = validations.every(v => v);
    console.log(`   All proofs valid: ${allValid ? '✅' : '❌'}\n`);
    
    // Tree introspection
    console.log('3. Tree introspection...');
    for (let level = 0; level <= 3; level++) {
        const nodes = tree.getNodesAtLevel(level);
        console.log(`   Level ${level}: ${nodes.length} nodes`);
    }
    
    console.log('\n🏆 Advanced examples completed!');
}

// Error handling example
async function errorHandlingExample() {
    console.log('\n🛡️ Error Handling Example\n');
    
    const poseidon = await buildPoseidon();
    const tree = new IndexedMerkleTree(poseidon);
    
    // Test various error conditions
    console.log('1. Testing error conditions...');
    
    try {
        tree.getNodesAtLevel(-1);
    } catch (error) {
        console.log(`   ✅ Invalid level error: ${error.message}`);
    }
    
    try {
        tree.getNodesAtLevel(100);
    } catch (error) {
        console.log(`   ✅ Invalid level error: ${error.message}`);
    }
    
    try {
        await IndexedMerkleTree.loadFromFile('./nonexistent-file.json');
    } catch (error) {
        console.log(`   ✅ File not found error: ${error.message}`);
    }
    
    console.log('\n🛡️ Error handling examples completed!');
}

// Run all examples
async function runAllExamples() {
    try {
        await basicUsageExample();
        await advancedUsageExample();
        await errorHandlingExample();
        
        console.log('\n✨ All examples completed successfully! ✨');
        
    } catch (error) {
        console.error('\n💥 Examples failed:', error);
        process.exit(1);
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    runAllExamples();
}

module.exports = {
    basicUsageExample,
    advancedUsageExample,
    errorHandlingExample,
    runAllExamples
};
