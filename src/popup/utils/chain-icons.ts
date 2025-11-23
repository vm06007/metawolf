/**
 * Chain icon utilities - provides both colored and white logos from DeBank
 *
 * Colored logos are for use on light backgrounds (like modals)
 * White logos are for use on dark/blue backgrounds
 *
 * These logos are from DeBank (same as clone folder)
 */

// Map of chain IDs to colored logo URLs from DeBank
// These are the regular colored logos used in the clone folder
// Extracted from clone/src/constant/default-support-chains.json
const CHAIN_COLORED_LOGOS: Record<number, string> = {
    1: 'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
    10: 'https://static.debank.com/image/chain/logo_url/op/68bef0c9f75488f4e302805ef9c8fc84.png',
    14: 'https://static.debank.com/image/chain/logo_url/flr/9ee03d5d7036ad9024e81d55596bb4dc.png',
    25: 'https://static.debank.com/image/chain/logo_url/cro/f947000cc879ee8ffa032793808c741c.png',
    30: 'https://static.debank.com/image/chain/logo_url/rsk/ff47def89fba98394168bf5f39920c8c.png',
    40: 'https://static.debank.com/image/chain/logo_url/tlos/6191b8e0b261536044fc70ba746ba2c9.png',
    56: 'https://static.debank.com/image/chain/logo_url/bsc/bc73fa84b7fc5337905e527dadcbc854.png',
    100: 'https://static.debank.com/image/chain/logo_url/xdai/43c1e09e93e68c9f0f3b132976394529.png',
    109: 'https://static.debank.com/image/chain/logo_url/shib/4ec79ed9ee4988dfdfc41e1634a447be.png',
    122: 'https://static.debank.com/image/chain/logo_url/fuse/7a21b958761d52d04ff0ce829d1703f4.png',
    130: 'https://static.debank.com/image/chain/logo_url/uni/7e9011cb7bd0d19deb7727280aa5c8b1.png',
    137: 'https://static.debank.com/image/chain/logo_url/matic/52ca152c08831e4765506c9bd75767e8.png',
    146: 'https://static.debank.com/image/chain/logo_url/sonic/8ba4d8395618ec1329ea7142b0fde642.png',
    169: 'https://static.debank.com/image/chain/logo_url/manta/0e25a60b96a29d6a5b9e524be7565845.png',
    177: 'https://static.debank.com/image/chain/logo_url/hsk/3f35eb1691403fe4eae7a1d1c45b704c.png',
    185: 'https://static.debank.com/image/chain/logo_url/mint/86404f93cd4e51eafcc2e244d417c03f.png',
    196: 'https://static.debank.com/image/chain/logo_url/xlayer/282a62903a4c74a964b704a161d1ba39.png',
    204: 'https://static.debank.com/image/chain/logo_url/opbnb/07e2e686e363a842d0982493638e1285.png',
    223: 'https://static.debank.com/image/chain/logo_url/b2/6ca6c8bc33af59c5b9273a2b7efbd236.png',
    232: 'https://static.debank.com/image/chain/logo_url/lens/d41e14ba300d526518fb8ad20714685b.png',
    239: 'https://static.debank.com/image/chain/logo_url/tac/4b57fdb89de90a15f366cdf4bdc92665.png',
    248: 'https://static.debank.com/image/chain/logo_url/oas/61dfecab1ba8a404354ce94b5a54d4b3.png',
    250: 'https://static.debank.com/image/chain/logo_url/ftm/14133435f89637157a4405e954e1b1b2.png',
    252: 'https://static.debank.com/image/chain/logo_url/frax/2e210d888690ad0c424355cc8471d48d.png',
    288: 'https://static.debank.com/image/chain/logo_url/boba/e43d79cd8088ceb3ea3e4a240a75728f.png',
    291: 'https://static.debank.com/image/chain/logo_url/orderly/aedf85948240dddcf334205794d2a6c9.png',
    324: 'https://static.debank.com/image/chain/logo_url/era/2cfcd0c8436b05d811b03935f6c1d7da.png',
    388: 'https://static.debank.com/image/chain/logo_url/croze/e9572bb5f00a04dd2e828dae75456abe.png',
    480: 'https://static.debank.com/image/chain/logo_url/world/3e8c6af046f442cf453ce79a12433e2f.png',
    592: 'https://static.debank.com/image/chain/logo_url/astar/398c7e0014bdada3d818367a7273fabe.png',
    999: 'https://static.debank.com/image/chain/logo_url/hyper/0b3e288cfe418e9ce69eef4c96374583.png',
    1030: 'https://static.debank.com/image/chain/logo_url/cfx/eab0c7304c6820b48b2a8d0930459b82.png',
    1088: 'https://static.debank.com/image/chain/logo_url/metis/7485c0a61c1e05fdf707113b6b6ac917.png',
    1101: 'https://static.debank.com/image/chain/logo_url/pze/a2276dce2d6a200c6148fb975f0eadd3.png',
    1111: 'https://static.debank.com/image/chain/logo_url/wemix/d1ba88d1df6cca0b0cb359c36a09c054.png',
    1116: 'https://static.debank.com/image/chain/logo_url/core/ccc02f660e5dd410b23ca3250ae7c060.png',
    1135: 'https://static.debank.com/image/chain/logo_url/lisk/4d4970237c52104a22e93993de3dcdd8.png',
    1284: 'https://static.debank.com/image/chain/logo_url/mobm/fcfe3dee0e55171580545cf4d4940257.png',
    1285: 'https://static.debank.com/image/chain/logo_url/movr/cfdc1aef482e322abd02137b0e484dba.png',
    1329: 'https://static.debank.com/image/chain/logo_url/sei/34ddf58f678be2db5b2636b59c9828b5.png',
    1480: 'https://static.debank.com/image/chain/logo_url/vana/b2827795c1556eeeaeb58cb3411d0b15.png',
    1514: 'https://static.debank.com/image/chain/logo_url/story/d2311c0952f9801e0d42e3b87b4bd755.png',
    1625: 'https://static.debank.com/image/chain/logo_url/gravity/fa9a1d29f671b85a653f293893fa27e3.png',
    1729: 'https://static.debank.com/image/chain/logo_url/reya/20d71aad4279c33229297da1f00d8ae1.png',
    1868: 'https://static.debank.com/image/chain/logo_url/soneium/35014ebaa414b336a105ff2115ba2116.png',
    1923: 'https://static.debank.com/image/chain/logo_url/swell/3e98b1f206af5f2c0c2cc4d271ee1070.png',
    2000: 'https://static.debank.com/image/chain/logo_url/doge/2538141079688a7a43bc22c7b60fb45f.png',
    2020: 'https://static.debank.com/image/chain/logo_url/ron/6e0f509804bc83bf042ef4d674c1c5ee.png',
    2222: 'https://static.debank.com/image/chain/logo_url/kava/b26bf85a1a817e409f9a3902e996dc21.png',
    2345: 'https://static.debank.com/image/chain/logo_url/goat/b324eea675692ec1c99a83e415386ed0.png',
    2410: 'https://static.debank.com/image/chain/logo_url/karak/a9e47f00f6eeb2c9cc8f9551cff5fe68.png',
    2741: 'https://static.debank.com/image/chain/logo_url/abs/c59200aadc06c79d7c061cfedca85c38.png',
    2818: 'https://static.debank.com/image/chain/logo_url/morph/2b5255a6c3a36d4b39e1dea02aa2f097.png',
    4200: 'https://static.debank.com/image/chain/logo_url/merlin/458e4686dfb909ba871bd96fe45417a8.png',
    4689: 'https://static.debank.com/image/chain/logo_url/iotx/d3be2cd8677f86bd9ab7d5f3701afcc9.png',
    5000: 'https://static.debank.com/image/chain/logo_url/mnt/0af11a52431d60ded59655c7ca7e1475.png',
    50104: 'https://static.debank.com/image/chain/logo_url/sophon/edc0479e5fc884b240959449ef44a386.png',
    534352: 'https://static.debank.com/image/chain/logo_url/scrl/1fa5c7e0bfd353ed0a97c1476c9c42d2.png',
    53935: 'https://static.debank.com/image/chain/logo_url/dfk/233867c089c5b71be150aa56003f3f7a.png',
    543210: 'https://static.debank.com/image/chain/logo_url/zero/d9551d98b98482204b93544f90b43985.png',
    5545: 'https://static.debank.com/image/chain/logo_url/duck/b0b13c10586f03bcfc12358c48a22c95.png',
    57073: 'https://static.debank.com/image/chain/logo_url/ink/af5b553a5675342e28bdb794328e8727.png',
    59144: 'https://static.debank.com/image/chain/logo_url/linea/32d4ff2cf92c766ace975559c232179c.png',
    6001: 'https://static.debank.com/image/chain/logo_url/bb/da74a4980f24d870cb43ccd763e0c966.png',
    60808: 'https://static.debank.com/image/chain/logo_url/bob/4e0029be99877775664327213a8da60e.png',
    7000: 'https://static.debank.com/image/chain/logo_url/zeta/d0e1b5e519d99c452a30e83a1263d1d0.png',
    747474: 'https://static.debank.com/image/chain/logo_url/katana/0202d6aecd963a9c0b2afb56c4d731b5.png',
    7560: 'https://static.debank.com/image/chain/logo_url/cyber/3a3c0c5da5fa8876c8c338afae0db478.png',
    7700: 'https://static.debank.com/image/chain/logo_url/canto/47574ef619e057d2c6bbce1caba57fb6.png',
    7777777: 'https://static.debank.com/image/chain/logo_url/zora/de39f62c4489a2359d5e1198a8e02ef1.png',
    80094: 'https://static.debank.com/image/chain/logo_url/bera/89db55160bb8bbb19464cabf17e465bc.png',
    81457: 'https://static.debank.com/image/chain/logo_url/blast/15132294afd38ce980639a381ee30149.png',
    8217: 'https://static.debank.com/image/chain/logo_url/klay/4182ee077031d843a57e42746c30c072.png',
    8453: 'https://static.debank.com/image/chain/logo_url/base/ccc1513e4f390542c4fb2f4b88ce9579.png',
    88888: 'https://static.debank.com/image/chain/logo_url/chiliz/548bc261b49eabea7227832374e1fcb0.png',
    9745: 'https://static.debank.com/image/chain/logo_url/plasma/baafefce3b9d43b12b0c016f30aff140.png',
    98866: 'https://static.debank.com/image/chain/logo_url/plume/f74d0d202dd8af7baf6940864ee79006.png',
    124816: 'https://static.debank.com/image/chain/logo_url/mito/d18958f17a84f20257ed89eff5ce6ff7.png',
    167000: 'https://static.debank.com/image/chain/logo_url/taiko/7723fbdb38ef181cd07a8b8691671e6b.png',
    200901: 'https://static.debank.com/image/chain/logo_url/btr/78ff16cf14dad73c168a70f7c971e401.png',
    1380012617: 'https://static.debank.com/image/chain/logo_url/rari/67fc6abba5cfc6bb3a57bb6afcf5afee.png',
    1440000: 'https://static.debank.com/image/chain/logo_url/xrpl/131298e77672be4a16611a103fa39366.png',
    20240603: 'https://static.debank.com/image/chain/logo_url/dbk/1255de5a9316fed901d14c069ac62f39.png',
    21000000: 'https://static.debank.com/image/chain/logo_url/corn/2ac7405fee5fdeee5964ba0bcf2216f4.png',
    33139: 'https://static.debank.com/image/chain/logo_url/ape/290d3884861ae5e09394c913f788168d.png',
    34443: 'https://static.debank.com/image/chain/logo_url/mode/466e6e12f4fd827f8f497cceb0601a5e.png',
    42161: 'https://static.debank.com/image/chain/logo_url/arb/854f629937ce94bebeb2cd38fb336de7.png',
    42170: 'https://static.debank.com/image/chain/logo_url/nova/06eb2b7add8ba443d5b219c04089c326.png',
    42220: 'https://static.debank.com/image/chain/logo_url/celo/faae2c36714d55db1d7a36aba5868f6a.png',
    42793: 'https://static.debank.com/image/chain/logo_url/ethlink/76f6335793b594863f41df992dc53d22.png',
    43111: 'https://static.debank.com/image/chain/logo_url/hemi/db2e74d52c77b941d01f9beae0767ab6.png',
    43114: 'https://static.debank.com/image/chain/logo_url/avax/4d1649e8a0c7dec9de3491b81807d402.png',
    48900: 'https://static.debank.com/image/chain/logo_url/zircuit/0571a12255432950da5112437058fa5b.png',
    13371: 'https://static.debank.com/image/chain/logo_url/itze/ce3a511dc511053b1b35bb48166a5d39.png',
    // Testnets - use Ethereum logo as fallback since testnets may not have distinct logos
    5: 'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png', // Goerli
    11155111: 'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png', // Sepolia
};

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

// Fallback logo sources for common chains
const FALLBACK_CHAIN_LOGOS: Record<number, string[]> = {
    1: [
        'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
        'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=040',
        'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2MjcFRUEiLz4KPHBhdGggZD0iTTE2IDhMMjAgMTJIMTZWMjRIMTJWMjBIMTJWMTJIMTZWOE0xNiA4SDEyVjEySDE2VjhNMTYgMTJIMjBWMjBIMTZWMjBNMTYgMTJIMTJWMjBIMTZWMjAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K'
    ],
    10: [
        'https://static.debank.com/image/chain/logo_url/op/68bef0c9f75488f4e302805ef9c8fc84.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png'
    ],
    137: [
        'https://static.debank.com/image/chain/logo_url/matic/52ca152c08831e4765506c9bd75767e8.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png'
    ],
    42161: [
        'https://static.debank.com/image/chain/logo_url/arb/854f629937ce94bebeb2cd38fb336de7.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png'
    ],
    8453: [
        'https://static.debank.com/image/chain/logo_url/base/ccc1513e4f390542c4fb2f4b88ce9579.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png'
    ],
    56: [
        'https://static.debank.com/image/chain/logo_url/bsc/bc73fa84b7fc5337905e527dadcbc854.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png'
    ],
    43114: [
        'https://static.debank.com/image/chain/logo_url/avax/4d1649e8a0c7dec9de3491b81807d402.png',
        'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png'
    ]
};

/**
 * Get colored logo URL for a chain ID (for use on light backgrounds like modals)
 * Includes fallback sources if primary logo fails
 */
export function getChainColoredLogo(chainId: number, fallbackLogo?: string): string {
    const primaryLogo = CHAIN_COLORED_LOGOS[chainId];
    if (primaryLogo) return primaryLogo;
    
    // Try fallback sources
    const fallbacks = FALLBACK_CHAIN_LOGOS[chainId];
    if (fallbacks && fallbacks.length > 0) {
        return fallbacks[0];
    }
    
    return fallbackLogo || '';
}

/**
 * Get white logo URL for a chain ID (for use on blue/dark backgrounds)
 * Falls back to colored logo if white logo not available
 */
export function getChainWhiteLogo(chainId: number, fallbackLogo?: string): string {
    const whiteLogo = CHAIN_WHITE_LOGOS[chainId];
    if (whiteLogo) return whiteLogo;
    
    // Fallback to colored logo
    const coloredLogo = getChainColoredLogo(chainId, fallbackLogo);
    if (coloredLogo) return coloredLogo;
    
    return fallbackLogo || '';
}

/**
 * Get chain logo - prefers colored logo by default (for modals/light backgrounds)
 * Set useWhite=true for dark backgrounds
 */
export function getChainLogo(chainId: number, fallbackLogo?: string, useWhite: boolean = false): string {
    if (useWhite) {
        const whiteLogo = getChainWhiteLogo(chainId, fallbackLogo);
        if (whiteLogo) return whiteLogo;
    } else {
        const coloredLogo = getChainColoredLogo(chainId, fallbackLogo);
        if (coloredLogo) return coloredLogo;
    }
    return fallbackLogo || '';
}

/**
 * Get all fallback logo URLs for a chain (for use in img srcset or fallback chain)
 */
export function getChainLogoFallbacks(chainId: number): string[] {
    const fallbacks = FALLBACK_CHAIN_LOGOS[chainId] || [];
    const primary = CHAIN_COLORED_LOGOS[chainId];
    if (primary && !fallbacks.includes(primary)) {
        return [primary, ...fallbacks];
    }
    return fallbacks.length > 0 ? fallbacks : [primary || ''].filter(Boolean);
}
