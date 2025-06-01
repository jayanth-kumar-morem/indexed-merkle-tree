import {buildPoseidon} from "circomlibjs";
import * as fs from 'fs';
import * as path from 'path';

export interface Leaf {
    val: bigint;
    nextVal: bigint;
    nextIdx: number;
}

export interface NonMembershipProof {
    query: bigint;
    preLeaf: Leaf;
    path: bigint[];
    directions: number[];
    root: bigint;
}

export interface SerializedIMT {
    depth: number;
    nodes: string[][];
    leaves: {
        val: string;
        nextVal: string;
        nextIdx: number;
    }[];
}

export class IndexedMerkleTree {
    readonly depth = 32;
    readonly zero: bigint;
    readonly poseidon: any;

    private nodes: bigint[][] = [];
    private leaves: Leaf[] = [];

    constructor(poseidon: any) {
        this.poseidon = poseidon;
        let zeros = [0n];
        for(let i=1;i<=this.depth; i++) {
            const hash = poseidon([zeros[i-1], zeros[i-1]]);
            zeros[i] = this.toField(hash);
        }
        this.zero = zeros[this.depth];

        for(let i=0; i<=this.depth; i++) this.nodes[i] = [];
        
        // Initialize with an empty leaf at index 0 to handle non-membership proofs
        this.leaves.push({val: 0n, nextVal: 0n, nextIdx: 0});
        this.updateLeafHash(0);
    }

    async new(): Promise<IndexedMerkleTree> {
        const poseidon = await buildPoseidon();
        return new IndexedMerkleTree(poseidon);
    }

    private leafHash(v: bigint, nextVal: bigint): bigint {
        const hash = this.poseidon([v, nextVal]);
        return this.toField(hash);
    }

    private parentHash(l: bigint, r: bigint): bigint {
        const hash = this.poseidon([l, r]);
        return this.toField(hash);
    }

    private toField(hash: any): bigint {
        if (typeof hash === 'bigint') {
            return hash;
        } else if (hash instanceof Uint8Array) {
            // Convert Uint8Array to bigint
            let result = 0n;
            for (let i = 0; i < hash.length; i++) {
                result = result * 256n + BigInt(hash[i]);
            }
            return result;
        } else if (Array.isArray(hash)) {
            // Handle array output
            let result = 0n;
            for (let i = 0; i < hash.length; i++) {
                result = result * 256n + BigInt(hash[i]);
            }
            return result;
        } else {
            return BigInt(hash);
        }
    }

    private predecessorIndex(x: bigint): number {
        let bestIdx = -1;
        let bestVal = -1n;
        
        for (let i = 0; i < this.leaves.length; i++) {
            if (this.leaves[i].val < x && this.leaves[i].val > bestVal) {
                bestIdx = i;
                bestVal = this.leaves[i].val;
            }
        }
        
        return bestIdx;
    }

    private setNode(level: number, index: number, h: bigint) {
        const arr = this.nodes[level];
        while (arr.length <= index) arr.push(this.zero);
        arr[index] = h;
    }

    async insert(x: bigint): Promise<void> {
        // Check if value already exists
        if (this.leaves.some(leaf => leaf.val === x)) {
            throw new Error(`Value ${x} already exists in the tree`);
        }

        const preIdx = this.predecessorIndex(x);
        const newIdx = this.leaves.length;
        
        if (preIdx >= 0) {
            const predecessor = this.leaves[preIdx];
            const sucIdx = predecessor.nextIdx;
            const sucVal = predecessor.nextVal;
            
            // Create new leaf
            this.leaves.push({val: x, nextIdx: sucIdx, nextVal: sucVal});
            
            // Update predecessor to point to new leaf
            this.leaves[preIdx].nextIdx = newIdx;
            this.leaves[preIdx].nextVal = x;
            
            // Update hashes
            this.updateLeafHash(preIdx);
        } else {
            // This should never happen with proper initialization
            throw new Error("No predecessor found - tree not properly initialized");
        }
        
        this.updateLeafHash(newIdx);
    }

    private updateLeafHash(leafIdx: number) {
        const leaf = this.leaves[leafIdx];
        let h = this.leafHash(leaf.val, leaf.nextVal);
        this.setNode(0, leafIdx, h);

        let currentIdx = leafIdx;
        for(let lvl = 0; lvl < this.depth; lvl++) {
            const isRight = currentIdx & 1;
            const siblingIdx = isRight ? currentIdx - 1 : currentIdx + 1;
            
            // Get sibling hash (default to zero if doesn't exist)
            const siblingHash = this.nodes[lvl][siblingIdx] ?? this.zero;
            
            // Compute parent hash
            const leftHash = isRight ? siblingHash : h;
            const rightHash = isRight ? h : siblingHash;
            h = this.parentHash(leftHash, rightHash);
            
            // Move to parent index
            currentIdx = Math.floor(currentIdx / 2);
            this.setNode(lvl + 1, currentIdx, h);
        }
    }

    get root(): bigint {
        const rootLevel = this.nodes[this.depth];
        if (rootLevel && rootLevel.length > 0) {
            return rootLevel[0];
        }
        return this.zero;
    }

    createNonMembershipProof(x: bigint): NonMembershipProof {
        const preLeafIdx = this.predecessorIndex(x);
        if(preLeafIdx < 0) {
            throw new Error("IMT requires at least one leaf before proving absence");
        }
        const preLeaf = this.leaves[preLeafIdx];
        const path: bigint[] = [];
        const directions: number[] = [];
        
        let currentIdx = preLeafIdx;
        for(let lvl = 0; lvl < this.depth; lvl++) {
            const isRight = currentIdx & 1;
            const siblingIdx = isRight ? currentIdx - 1 : currentIdx + 1;
            const siblingHash = this.nodes[lvl][siblingIdx] ?? this.zero;
            
            path.push(siblingHash);
            directions.push(isRight ? 1 : 0);
            
            currentIdx = Math.floor(currentIdx / 2);
        }
        
        return {
            directions,
            path,
            preLeaf,
            query: x,
            root: this.root
        };
    }

    verifyNonMembershipProof(p: NonMembershipProof): boolean {
        let h = this.leafHash(p.preLeaf.val, p.preLeaf.nextVal);
        for (let lvl =0;lvl<this.depth; lvl++){
            const sib = p.path[lvl];
            const dir = p.directions[lvl];
            h = dir ? this.parentHash(sib, h) : this.parentHash(h, sib);
        }
        if (h!==p.root) return false;
        if (!(p.preLeaf.val < p.query)) return false;
        if(p.preLeaf.nextVal !== 0n && !(p.query < p.preLeaf.nextVal)) return false;
        return true;
    }

    /**
     * Serializes the tree state to a JSON-compatible object
     */
    serialize(): SerializedIMT {
        return {
            depth: this.depth,
            nodes: this.nodes.map(level => level.map(node => node.toString())),
            leaves: this.leaves.map(leaf => ({
                val: leaf.val.toString(),
                nextVal: leaf.nextVal.toString(),
                nextIdx: leaf.nextIdx
            }))
        };
    }

    /**
     * Deserializes a tree state from a JSON-compatible object
     */
    static deserialize(data: SerializedIMT, poseidon: any): IndexedMerkleTree {
        const tree = new IndexedMerkleTree(poseidon);
        
        // Clear the default initialization
        tree.nodes = [];
        tree.leaves = [];
        
        // Restore nodes
        tree.nodes = data.nodes.map(level => level.map(node => BigInt(node)));
        
        // Restore leaves
        tree.leaves = data.leaves.map(leaf => ({
            val: BigInt(leaf.val),
            nextVal: BigInt(leaf.nextVal),
            nextIdx: leaf.nextIdx
        }));
        
        return tree;
    }

    /**
     * Saves the tree state to a file
     */
    async saveToFile(filePath: string): Promise<void> {
        const serialized = this.serialize();
        const jsonString = JSON.stringify(serialized, null, 2);
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonString, 'utf8');
    }

    /**
     * Loads a tree state from a file
     */
    static async loadFromFile(filePath: string, poseidon?: any): Promise<IndexedMerkleTree> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const jsonString = fs.readFileSync(filePath, 'utf8');
        const data: SerializedIMT = JSON.parse(jsonString);
        
        // If poseidon is not provided, build it
        if (!poseidon) {
            poseidon = await buildPoseidon();
        }
        
        return IndexedMerkleTree.deserialize(data, poseidon);
    }

    /**
     * Returns the current number of leaves in the tree
     */
    get size(): number {
        return this.leaves.length;
    }

    /**
     * Returns a copy of all leaves
     */
    getLeaves(): Leaf[] {
        return this.leaves.map(leaf => ({ ...leaf }));
    }

    /**
     * Returns a copy of all nodes at a specific level
     */
    getNodesAtLevel(level: number): bigint[] {
        if (level < 0 || level >= this.nodes.length) {
            throw new Error(`Invalid level: ${level}`);
        }
        return [...this.nodes[level]];
    }
}