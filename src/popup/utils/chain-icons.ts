/**
 * Chain icon utilities - uses white logos from DeBank (same as clone folder)
 * for better visibility on blue backgrounds
 * 
 * These white logos are extracted from clone/src/constant/default-support-chains.json
 */

// Map of chain IDs to white logo URLs from DeBank
// These are the same white logos used in the clone folder
const CHAIN_WHITE_LOGOS: Record<number, string> = {
    1: 'https://static.debank.com/image/chain/white_logo_url/eth/561dda8f1ed8f0b2f46474bde3f02d0b.png',
    10: 'https://static.debank.com/image/chain/white_logo_url/op/966add4bf770c2744c9b9e961ecaba62.png',
    14: 'https://static.debank.com/image/chain/white_logo_url/flr/ad866bf4323576b66651c9e2bbfd8a80.png',
    25: 'https://static.debank.com/image/chain/white_logo_url/cro/555a092be8378d6e55000b3846043bec.png',
    30: 'https://static.debank.com/image/chain/white_logo_url/rsk/8f621d4d08c69ba79d5aae53bc9d3eeb.png',
    40: 'https://static.debank.com/image/chain/white_logo_url/tlos/4db183821aac84407962bab4dcd5790e.png',
    56: 'https://static.debank.com/image/chain/white_logo_url/bsc/8e44e643d6e2fd335a72b4cda6368e1a.png',
    66: 'https://static.debank.com/image/chain/white_logo_url/okc/8e44e643d6e2fd335a72b4cda6368e1a.png',
    100: 'https://static.debank.com/image/chain/white_logo_url/xdai/d8744f83d1a3bef4941c0820d76242a2.png',
    109: 'https://static.debank.com/image/chain/white_logo_url/shib/574d888cbdce3a08ea8a5f636fc2ae3e.png',
    122: 'https://static.debank.com/image/chain/white_logo_url/fuse/ceda89bc24064a4c583f369811ee29b6.png',
    128: 'https://static.debank.com/image/chain/white_logo_url/heco/8e44e643d6e2fd335a72b4cda6368e1a.png',
    130: 'https://static.debank.com/image/chain/white_logo_url/uni/2a9b07539e6e021a2227ed3366ca49ef.png',
    137: 'https://static.debank.com/image/chain/white_logo_url/matic/d9d33b57922dce7a5ac567b0e5eb1e4b.png',
    146: 'https://static.debank.com/image/chain/white_logo_url/sonic/4df25e2d582b0922a91d633e666f7819.png',
    169: 'https://static.debank.com/image/chain/white_logo_url/manta/ead2552c140ffd5482e7222964bac558.png',
    177: 'https://static.debank.com/image/chain/white_logo_url/hsk/9f65d77bebc45001227ab49e91253a79.png',
    185: 'https://static.debank.com/image/chain/white_logo_url/mint/1bc50cbf5ec022d40efe48c4ec68c25d.png',
    196: 'https://static.debank.com/image/chain/white_logo_url/xlayer/bb5d85b54ec4634bd8b6703b27e254ba.png',
    204: 'https://static.debank.com/image/chain/white_logo_url/opbnb/8e44e643d6e2fd335a72b4cda6368e1a.png',
    223: 'https://static.debank.com/image/chain/white_logo_url/b2/3df748afc47cc1c76107981bc312a190.png',
    232: 'https://static.debank.com/image/chain/white_logo_url/lens/57f2d61cc18b6ed64df58b42bdb0a123.png',
    239: 'https://static.debank.com/image/chain/white_logo_url/tac/943321d39fc15b20bbd5561fa894a09f.png',
    248: 'https://static.debank.com/image/chain/white_logo_url/oas/95888aa80c9eb4dbde714c69b3cc7425.png',
    250: 'https://static.debank.com/image/chain/white_logo_url/ftm/64178bae592be3a33c160b1d9b9a124a.png',
    252: 'https://static.debank.com/image/chain/white_logo_url/frax/7ae2bc54b406cd3c378b0bd28df2b3ff.png',
    288: 'https://static.debank.com/image/chain/white_logo_url/boba/aea02e2a1cf1087f299f4d501777d0cd.png',
    291: 'https://static.debank.com/image/chain/white_logo_url/orderly/ecc7f748276e001bc14c9233e2342426.png',
    324: 'https://static.debank.com/image/chain/white_logo_url/era/ae1951502c3514d43374d7e6718bda9a.png',
    388: 'https://static.debank.com/image/chain/white_logo_url/croze/0cd7713510320f906a8c55421e0474fe.png',
    480: 'https://static.debank.com/image/chain/white_logo_url/world/dfccb8b06d95ecbc30c2b88c3261ae9c.png',
    592: 'https://static.debank.com/image/chain/white_logo_url/astar/116f17a7abe800b7675377857fac1dcd.png',
    999: 'https://static.debank.com/image/chain/white_logo_url/hyper/3584b246dce2a56b696eec09824191e9.png',
    1030: 'https://static.debank.com/image/chain/white_logo_url/cfx/d45e5225fc8e97623c798599a2f8ce50.png',
    1088: 'https://static.debank.com/image/chain/white_logo_url/metis/3fb2c5171563b035fe4add98eca01efc.png',
    1101: 'https://static.debank.com/image/chain/white_logo_url/pze/94d0cff539cb8f18c93f11a454f894b3.png',
    1111: 'https://static.debank.com/image/chain/white_logo_url/wemix/66b877a83349d6d158796f825f5b9633.png',
    1116: 'https://static.debank.com/image/chain/white_logo_url/core/e52df8e06f7763e05e1d94cce21683a5.png',
    1135: 'https://static.debank.com/image/chain/white_logo_url/lisk/492c4705b0b77c4e0277d87c3f213d04.png',
    1284: 'https://static.debank.com/image/chain/white_logo_url/mobm/f81571ea549a63e6ea3d990e93f2a6f6.png',
    1285: 'https://static.debank.com/image/chain/white_logo_url/movr/7cf3b2c4406b3a5a59190f348e406b43.png',
    1329: 'https://static.debank.com/image/chain/white_logo_url/sei/632af17fefaa435817bd6bc3c549280d.png',
    1480: 'https://static.debank.com/image/chain/white_logo_url/vana/86f5ec38b5d764c49855cd086eb7ca01.png',
    1514: 'https://static.debank.com/image/chain/white_logo_url/story/ea3699b98a9d331e0545b8358229b7ef.png',
    1625: 'https://static.debank.com/image/chain/white_logo_url/gravity/3199386503fe33125ebd841f42562452.png',
    1729: 'https://static.debank.com/image/chain/white_logo_url/reya/7643e04c35af62a7572aecbdc4565040.png',
    1868: 'https://static.debank.com/image/chain/white_logo_url/soneium/274e9c0e0556afbf0268535f4b6f83ac.png',
    1923: 'https://static.debank.com/image/chain/white_logo_url/swell/630df2f6a1c5933209268437873a4ffe.png',
    2000: 'https://static.debank.com/image/chain/white_logo_url/doge/aa18ed341ae19e5e381dfac1062fee73.png',
    2020: 'https://static.debank.com/image/chain/white_logo_url/ron/a7164cbb1bcf36c6b13abece4956e7ec.png',
    2222: 'https://static.debank.com/image/chain/white_logo_url/kava/2e672dd7947e41a34d6cbc5995ad24b2.png',
    2345: 'https://static.debank.com/image/chain/white_logo_url/goat/f1049e8784a8643be820417f4f4c7654.png',
    2410: 'https://static.debank.com/image/chain/white_logo_url/karak/5d5ca3507b4a1d64a85406f7382412d7.png',
    2741: 'https://static.debank.com/image/chain/white_logo_url/abs/7a1ee8ff339decb2c2de8260db929d10.png',
    2818: 'https://static.debank.com/image/chain/white_logo_url/morph/f0bbba51d75fca1797c9c90654a71632.png',
    4200: 'https://static.debank.com/image/chain/white_logo_url/merlin/72e28432e865c544c1045017892187bc.png',
    4689: 'https://static.debank.com/image/chain/white_logo_url/iotx/419fdcf87eceb9b8c34af0c5e3985d44.png',
    5000: 'https://static.debank.com/image/chain/white_logo_url/mnt/f642653f191f4fd59cbf9efefc4c007d.png',
    50104: 'https://static.debank.com/image/chain/white_logo_url/sophon/a14020d6bff4832660dd3df13f4398b6.png',
    534352: 'https://static.debank.com/image/chain/white_logo_url/scrl/dd0d05b6fba614d57b55f0724acd723c.png',
    53935: 'https://static.debank.com/image/chain/white_logo_url/dfk/bab611be6bf763da73c6179c2150ffdf.png',
    543210: 'https://static.debank.com/image/chain/white_logo_url/zero/bba7ede18928b06c8986bfcc7415de9a.png',
    5545: 'https://static.debank.com/image/chain/white_logo_url/duck/054c478f68f458c5f523bd45a815d394.png',
    57073: 'https://static.debank.com/image/chain/white_logo_url/ink/e0bb13be095ecf667e631ee9b3fb4743.png',
    59144: 'https://static.debank.com/image/chain/white_logo_url/linea/adee1a93003ab543957692844fdaf9f2.png',
    6001: 'https://static.debank.com/image/chain/white_logo_url/bb/31ba7b64206471376f34f2b4c5c097f8.png',
    60808: 'https://static.debank.com/image/chain/white_logo_url/bob/7f61e1ed6fae04833ee21d83c9998d22.png',
    7000: 'https://static.debank.com/image/chain/white_logo_url/zeta/fb4ab4eb798244887bfd65455bd42d6b.png',
    747474: 'https://static.debank.com/image/chain/white_logo_url/katana/7b9c62314be807a5a5c60fbc9b9e2fbf.png',
    7560: 'https://static.debank.com/image/chain/white_logo_url/cyber/239566559dc0c5fd5f5e2d76b85c6490.png',
    7700: 'https://static.debank.com/image/chain/white_logo_url/canto/29bd07f96ac7805a1b14649f356d3eee.png',
    7777777: 'https://static.debank.com/image/chain/white_logo_url/zora/25dfb04c552c35d3d8e30e5ba136b9e6.png',
    80094: 'https://static.debank.com/image/chain/white_logo_url/bera/719c22be74d06397be17a028caf8d873.png',
    81457: 'https://static.debank.com/image/chain/white_logo_url/blast/828eb570083948e156a34ab8588e26b3.png',
    8217: 'https://static.debank.com/image/chain/white_logo_url/klay/9a89223ec7fcb2acf4bde5600fdd3153.png',
    8453: 'https://static.debank.com/image/chain/white_logo_url/base/025de9d02848e257740c14bdd1f9330b.png',
    88888: 'https://static.debank.com/image/chain/white_logo_url/chiliz/48a3f9ae39cc1c78eb5ad7c41a7c4f79.png',
    9004: 'https://static.debank.com/image/chain/white_logo_url/starknet/8e44e643d6e2fd335a72b4cda6368e1a.png',
    9745: 'https://static.debank.com/image/chain/white_logo_url/plasma/ababa793ba3e472641d628b046223ae0.png',
    98866: 'https://static.debank.com/image/chain/white_logo_url/plume/4fe2a83f0533b5e83fa6b090971a624a.png',
    124816: 'https://static.debank.com/image/chain/white_logo_url/mito/2b502d8118298f62232b15acf1aac712.png',
    167000: 'https://static.debank.com/image/chain/white_logo_url/taiko/16d831636a2aa32e5b58f264a61311e0.png',
    200901: 'https://static.debank.com/image/chain/white_logo_url/btr/33a233f67cb62320dd49c7a3a05c1d4b.png',
    1380012617: 'https://static.debank.com/image/chain/white_logo_url/rari/73456a9386ce19d00584fec493206005.png',
    1440000: 'https://static.debank.com/image/chain/white_logo_url/xrpl/6b10cbf7b85b3975b8faebfa3a1989c9.png',
    20240603: 'https://static.debank.com/image/chain/white_logo_url/dbk/f3b17c6a54b98b86a158061706277f06.png',
    21000000: 'https://static.debank.com/image/chain/white_logo_url/corn/a4e8a975e17b574786f9ac51bf9ba87a.png',
    33139: 'https://static.debank.com/image/chain/white_logo_url/ape/2e390ca2ec4052728f7e7772a21f2591.png',
    34443: 'https://static.debank.com/image/chain/white_logo_url/mode/f7033404c6d09fafcbe53cbf806a585f.png',
    42161: 'https://static.debank.com/image/chain/white_logo_url/arb/315c3c4560a12e9c94841706e3ed9ce5.png',
    42170: 'https://static.debank.com/image/chain/white_logo_url/nova/b61c3a7723f39265c8b98967407e46db.png',
    42220: 'https://static.debank.com/image/chain/white_logo_url/celo/09ce760b8a31dc444943507497e11755.png',
    42262: 'https://static.debank.com/image/chain/white_logo_url/oasis/8e44e643d6e2fd335a72b4cda6368e1a.png',
    42793: 'https://static.debank.com/image/chain/white_logo_url/ethlink/e909351e42bae619265a39671a18e698.png',
    43111: 'https://static.debank.com/image/chain/white_logo_url/hemi/b4be19ebeb70986fd4fc8ce291380a06.png',
    43114: 'https://static.debank.com/image/chain/white_logo_url/avax/e8a86458cb9e656052f0250d079622d8.png',
    48900: 'https://static.debank.com/image/chain/white_logo_url/zircuit/9249ce9ad3bc83058bdffd2bec69fd3a.png',
    13371: 'https://static.debank.com/image/chain/white_logo_url/itze/b6e7827808bbab397b73d6db107b2071.png',
    1313161554: 'https://static.debank.com/image/chain/white_logo_url/aurora/8e44e643d6e2fd335a72b4cda6368e1a.png',
    1666600000: 'https://static.debank.com/image/chain/white_logo_url/harmony/8e44e643d6e2fd335a72b4cda6368e1a.png',
};

/**
 * Get white logo URL for a chain ID (for use on blue/dark backgrounds)
 * Falls back to regular logo if white logo not available
 */
export function getChainWhiteLogo(chainId: number, fallbackLogo?: string): string {
    return CHAIN_WHITE_LOGOS[chainId] || fallbackLogo || '';
}

/**
 * Get chain logo - prefers white logo for better visibility
 */
export function getChainLogo(chainId: number, fallbackLogo?: string, useWhite: boolean = true): string {
    if (useWhite) {
        const whiteLogo = getChainWhiteLogo(chainId, fallbackLogo);
        if (whiteLogo) return whiteLogo;
    }
    return fallbackLogo || '';
}
