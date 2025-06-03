import * as fs from 'fs';
import * as path from 'path';
import {poseidon2} from "poseidon-lite";

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
    readonly zeros: bigint[];
    readonly zero: bigint;

    private nodes: bigint[][] = [];
    private leaves: Leaf[] = [];

    constructor() {
        this.zeros = [0n];
        for (let i = 1; i <= this.depth; i++) {
            this.zeros[i] = poseidon2([this.zeros[i - 1], this.zeros[i - 1]])
        }
        this.zero = this.zeros[this.depth];

        for(let i=0; i<=this.depth; i++) this.nodes[i] = [];

        this.leaves.push({val: 0n, nextVal: 0n, nextIdx: 0});
        this.updateLeafHash(0);
    }

    async new(): Promise<IndexedMerkleTree> {
        return new IndexedMerkleTree();
    }

    private leafHash(v: bigint, nextVal: bigint): bigint {
        const hash = poseidon2([v, nextVal]);
        return this.toField(hash);
    }

    private parentHash(l: bigint, r: bigint): bigint {
        const hash = poseidon2([l, r]);
        return this.toField(hash);
    }

    private toField(hash: any): bigint {
        if (typeof hash === 'bigint') {
            return hash;
        } else if (hash instanceof Uint8Array) {
            let result = 0n;
            for (let i = 0; i < hash.length; i++) {
                result = result * 256n + BigInt(hash[i]);
            }
            return result;
        } else if (Array.isArray(hash)) {
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
        while (arr.length <= index) arr.push(this.zeros[level]);
        arr[index] = h;
    }

    async insert(x: bigint): Promise<void> {
        if (this.leaves.some(leaf => leaf.val === x)) {
            throw new Error(`Value ${x} already exists in the tree`);
        }

        const preIdx = this.predecessorIndex(x);
        const newIdx = this.leaves.length;
        
        if (preIdx >= 0) {
            const predecessor = this.leaves[preIdx];
            const sucIdx = predecessor.nextIdx;
            const sucVal = predecessor.nextVal;
            
            this.leaves.push({val: x, nextIdx: sucIdx, nextVal: sucVal});
            
            this.leaves[preIdx].nextIdx = newIdx;
            this.leaves[preIdx].nextVal = x;
            
            this.updateLeafHash(preIdx);
        } else {
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
            
            const siblingHash = this.nodes[lvl][siblingIdx] ?? this.zeros[lvl];
            
            const leftHash = isRight ? siblingHash : h;
            const rightHash = isRight ? h : siblingHash;
            h = this.parentHash(leftHash, rightHash);
            
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
            const siblingHash = this.nodes[lvl][siblingIdx] ?? this.zeros[lvl];
            
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

    static deserialize(data: SerializedIMT): IndexedMerkleTree {
        const tree = new IndexedMerkleTree();
        
        tree.nodes = [];
        tree.leaves = [];
        
        tree.nodes = data.nodes.map(level => level.map(node => BigInt(node)));
        
        tree.leaves = data.leaves.map(leaf => ({
            val: BigInt(leaf.val),
            nextVal: BigInt(leaf.nextVal),
            nextIdx: leaf.nextIdx
        }));
        
        return tree;
    }

    async saveToFile(filePath: string): Promise<void> {
        const serialized = this.serialize();
        const jsonString = JSON.stringify(serialized, null, 2);
        
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonString, 'utf8');
    }

    static loadFromFile(filePath: string): IndexedMerkleTree {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        const jsonString = fs.readFileSync(filePath, 'utf8');
        const data: SerializedIMT = JSON.parse(jsonString);
        
        return IndexedMerkleTree.deserialize(data);
    }

    get size(): number {
        return this.leaves.length;
    }

    getLeaves(): Leaf[] {
        return this.leaves.map(leaf => ({ ...leaf }));
    }

    getNodesAtLevel(level: number): bigint[] {
        if (level < 0 || level >= this.nodes.length) {
            throw new Error(`Invalid level: ${level}`);
        }
        return [...this.nodes[level]];
    }
}