const fs = require('fs');
const crypto = require('crypto');
const secp256k1 = require('secp256k1');

// Load transactions from mempool
const mempoolDir = './mempool';
const transactions = [];
fs.readdirSync(mempoolDir).forEach(file => {
    const filePath = `${mempoolDir}/${file}`;
    const transaction = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    transactions.push(transaction);
});

// Validate transactions
const validTransactions = [];
transactions.forEach(transaction => {
    // Check if transaction is valid (e.g. correct format, valid signatures, etc.)
    if (validateTransaction(transaction)) {
        validTransactions.push(transaction);
    }
});

// Calculate total transaction fees
let totalFees = 0;
validTransactions.forEach(transaction => {
  transaction.vin.forEach(input => {
    totalFees += input.prevout.value;
  });
  transaction.vout.forEach(output => {
    totalFees -= output.value;
  });
});

// Create coinbase transaction
const coinbaseTransaction = {
  version: 1,
  locktime: 0,
  vin: [],
  vout: [
    {
      scriptpubkey: '76a9146085312a9c500ff9cc35b571b0a1e5efb7fb9f1688ac',
      scriptpubkey_asm: 'OP_DUP OP_HASH160 OP_PUSHBYTES_20 6085312a9c500ff9cc35b571b0a1e5efb7fb9f16 OP_EQUALVERIFY OP_CHECKSIG',
      scriptpubkey_type: 'p2pkh',
      scriptpubkey_address: '19oMRmCWMYuhnP5W61ABrjjxHc6RphZh11',
      value: 2500000 + totalFees // 25 BTC reward + total transaction fees
    }
  ]
};

// Mine block
const blockHeader = {
  version: 1,
  prevBlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
  merkleRoot: getMerkleRoot(validTransactions.concat([coinbaseTransaction])),
  timestamp: Math.floor(Date.now() / 1000),
  bits: 0x1903a30c, // difficulty target
  nonce: 0
};

let blockHash;
do {
  blockHash = getBlockHash(blockHeader);
  blockHeader.nonce++;
} while (blockHash > '0000ffff00000000000000000000000000000000000000000000000000000000');

// Write output to file
const outputFile = 'output.txt';
fs.writeFileSync(outputFile, `Block Header: ${getBlockHeaderString(blockHeader)}\n`);
fs.appendFileSync(outputFile, `Serialized Coinbase Transaction: ${getTransactionString(coinbaseTransaction)}\n`);
validTransactions.forEach(transaction => {
    fs.appendFileSync(outputFile, `Transaction ID: ${JSON.stringify(transaction.vin[0].txid)}\n`); // Assuming txid is within the first input
});


// Helper functions
function validateTransaction(transaction) {
    // Check if transaction has valid vin and vout
    if (!transaction.vin || !Array.isArray(transaction.vin)) {
        console.error(`Transaction ${transaction.txid} is invalid: missing or invalid vin`);
        return false;
    }
    if (!transaction.vout || !Array.isArray(transaction.vout)) {
        console.error(`Transaction ${transaction.txid} is invalid: missing or invalid vout`);
        return false;
    }

    // Check if each input and output has required fields
    for (let input of transaction.vin) {
        if (!input.scriptSig || !input.prevout || !input.prevout.txid || input.prevout.index == null) {
            console.error(`Transaction ${transaction.txid} is invalid: input ${JSON.stringify(input)} is missing required fields`);
            return false;
        }
    }
    for (let output of transaction.vout) {
        if (!output.scriptpubkey || output.value == null) {
            console.error(`Transaction ${transaction.txid} is invalid: output ${JSON.stringify(output)} is missing required fields`);
            return false;
        }
    }

    return true;
}

function getMerkleRoot(transactions) {
    const hashes = transactions.map(transaction => {
        const txHash = crypto.createHash('sha256');
        txHash.update(JSON.stringify(transaction));
        return txHash.digest('hex');
    });

    while (hashes.length > 1) {
        if (hashes.length % 2 != 0) {
            hashes.push(hashes[hashes.length - 1]);
        }

        const newHashes = [];
        for (let i = 0; i < hashes.length; i += 2) {
            const hashPair = hashes[i] + hashes[i + 1];
            const newHash = crypto.createHash('sha256');
            newHash.update(hashPair);
            newHashes.push(newHash.digest('hex'));
        }

        hashes = newHashes;
    }

    return hashes[0];
}

function getBlockHash(blockHeader) {
    const blockHeaderString = `${blockHeader.version}${blockHeader.prevBlockHash}${blockHeader.merkleRoot}${blockHeader.timestamp}${blockHeader.bits}${blockHeader.nonce}`;
    const blockHash = crypto.createHash('sha256');
    blockHash.update(blockHeaderString);
    return blockHash.digest('hex');
}

function getBlockHeaderString(blockHeader) {
    return `Version : ${blockHeader.version} , 
    Previous BlockHash :${blockHeader.prevBlockHash},
    MerkleRoot : ${blockHeader.merkleRoot} ,
    TimeStamp : ${blockHeader.timestamp} ,
    Bits : ${blockHeader.bits} ,
    Nonce : ${blockHeader.nonce}`;
}

function getTransactionString(transaction) {
    return JSON.stringify(transaction);
}