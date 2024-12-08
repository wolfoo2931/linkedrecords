
const avg = (array) => {
  const sum = array.reduce((x, acc) => {return acc+x;}, 0);
  return parseFloat(sum)/array.length;
}

const times = {
  createDocuments: [],
  listDocuments: [],
}

const user1 = {
  id: 'us-f2c8802ed422895ed52df524898103f2',
  clientId: '01935a11-85c4-7024-b228-f6ef5eb2c2bf',
  cookie: "userId=s%3Aus-f2c8802ed422895ed52df524898103f2.flriN20u%2FSyCfdWnRg4g3PbU%2BTbERFblYxqI9C85uUw; appSession=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwiaWF0IjoxNzMyMTA1MDQ0LCJ1YXQiOjE3MzI1MjQ5MzAsImV4cCI6MTczMjYxMTMzMH0..7EWMW3p1uRkzVuHl.4umgtq0IgusT_AMnlZKebLwHhAJPJKlRlp41X5wSD-5ct0B-6N0a-BTcgPBULUvoWsPtZDcuJ7mDwLCDBLd6rJrEBmwKNzI-AxwRZxzaib7yaBQNCdqOGyQp2nb6UjYfDqqW1MqeFQ5FrkvnO8B8KSXCzR31Kg9D9k_o4fU248no1j_9NJg_k1ZWM8OvZelR5fEHzWGlcT1ljbrs0p3IlkzKMmyGDC-aY00EDm520RFcD8RXaQ1mhFXjCqyYeRMhOe55v79gxHK0kAUIyCKQiEEk5NgDxWFUUUPwHQH-94Q-Z1RRcdzaFRBUdafKuokkypjBBbaGqJNhO_izDScTYF0BnESyEX-8TInAKtai93EprfeKdaVerLtAO5NANxODp_hzVHD0VcdNerTVLRkZmvW8w5J4DhaFSoyU_JreZwvKKQtgAUCkJPHZmQIY5lROsYV3In38tQZ1dPt9gymaeqfwFMezuGnNzU58-jTaTtG0CX7qKrsnotWa-p8BfmSlax6qgZIxjV5Slc843XJFCz33gsHHjXBy_sDWUzBwQngQPuR_Sjbq-RpC_3e-hSulEcu2uj8Oxm3XmtNNnHiOeQXDRfCqaP1sFhM-pPTwAaYQR1x10xRv2hofnhka1fxQwVTa3JFkZeBsTYEGj3K7yyTWyrKeZfP-1hVbN2PZiM39MpNHOU7j5ZSnrZWkzOgc6qckOouFts6l98v1PdBKwarQK9lSicWcfL2NrdjIQUoZ-ZSFjMTWiSO1GReWKiCZadaMSrc0__D1lFOIC0IY3Xso1-7It8poIuxwmanjM3VSHZXwXGIucpEH8acf0E7u79evu6ATV561sxW6ZnhyQYadXINWcem0QA07EjnLV45Cya7c_jYDPN8ddz1q-AF2IZRJjfPOwgYHyqP76BFXM1MYNXiUwx_SJLDitLeMFJGyObVTfNFj47xwXFYWmgZnjeIZwjVtjlkPcsfYAxsL-iYOYkrA2JuQVZlk4OR_0OtOr5a9_rg4utU1U6TyKwMP8mKHlLjv-dNK8-FmBowLa6rr-LkDJMAxnxpwbqZFROUVy4M5TTwSo0jDauhYvQRSTpKcQMs9nu4bU4tue-VvFfq8_HuRDUsB6d2mmy8jURDfi-VY-UuKtXlTGmUc9ReYtr_XwiPZDV8NdTCK9l4YPfSwOMGhGp-ZpiuVvoc92fwlesJQCwd7LNAwDJQd5UFZ7ST0wiZCUAtGXPKgi2omjlGE0zGnE20dw3bMrc1vRWSSArfv7kofTFsyDgYfU_XJGgygRGjjRujqPVdBVLL0rn6cb6VbwITBo9Q8sNVr4KJ7CZJg31EuuHK8FtLjNOENO2ZeKQaBSteYZQrziTNe2XimyCw3c_z8xzCx10CvM4fNUdfPEUp-ajwG68BUII50df_zotoMEZcKWsgMf3uen09tcLR81aCwdlFVZOpYxoUqqbVWryvJHvsqAAueKxzvEkzD4SE08Vly6O69mSufq9L9Vgp2oirp-5LZm0tTVrH3x2LL3HKHh8EN2P3hjhF9S8qXRbO0LV0gAT7yPGL2MzwsFd4Yqyje4EdpNaB332kABhV8gf2bO3uf2nirNG8tQflFnByilJw11jM-8OEIWAro7waVw8D-2gYIP5nhGJ_fEnMDu8-eBhwo4cHYEZ6yEOfnR317D5wo4Q8ybXKBXi-tRvy7WsxogsKDpm2KuoObVITFTEhtwYaThgyPXvmr3ZISlQ_MuuRL5hatGOAyUE9NcZcJPUpyTwQBzyg5VkALDSEqcAVqaR3H7Br-fvmIdJEhlKp8V5RltnPqhjRg-T041V86XeyxTO0ql8s5BQtysbvOe1m8l-8AuqIsY5TW-BF9rwPNrvIeEvuIfEZPhx0Ok0LvrhU1O2R5jsMbQGFQz5PVJ5SoM7fX672oPcENUPBZpTf1dlswWl9XbT0zsyPgOmsJ4zsTWE_mOJYlSH17LxENqnIS4vuPXJVEYAl99EujGhwCTnvmqTXn3APaRriiBUOarP7PBPwmzZZOB2ldiT3V-nEwR4rJizqNz2CvF-adGCRfWI0y02XGAgVt00WNckMPwo-KiS7PNx2nZAl0O2puMoIwVlfgh8Af5LcAi6kLeBpEHERNWEUSK7TT9e415x1_gFzzig.MC5MOmJCvQr-WGIXjiMetA",

}

//wolfoo2931+1@gmail.com
const user2 = {
  id: 'us-0a3f0f0024eeebda95a3413ebf8bb23d',
  clientId: '218c5999-544d-4f42-b97b-214e4f27f8da',
  cookie: "userId=s%3Aus-0a3f0f0024eeebda95a3413ebf8bb23d.7zU7tB0QW%2FuBqHG2TFWukw31mC1wrwNHbsW5cUQT%2Fhg; appSession=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwiaWF0IjoxNzMyNjExODQ2LCJ1YXQiOjE3MzI2MTE4NDksImV4cCI6MTczMjY5ODI0OX0..nYW5bMAiznwfjnD_.Pj9c_Jc7Z3PfHqmxFYrG3BeLFh_2kUUFv6gcWx3zEf1v4ipiSTuUsGCqMz1H-VVegS-X_Z8po2bpNCBZV_A4kBguWcb3Kg2bCrG6kF92rT_w0A2U-RRdbhZ-5au_BBzJ6iiqpi2Zq8UJdyDNwrDaq0bUIjUwp1YfFexZyBTLZFRu0L1DPsteyIssNppPmrtPbwz8g5g2OU3LrhuRmHVzk1tHiv1A1baWhvB-q5cavZwQ30Kv5WYIBGJun7QMoAEFKNC91DrcaGwUFJqygQP0BuTzZqcOgHJ-S6ADupanNwMku9udvePQkY1gJF643cWHcCgA-VsU9sn0GKgohNo7vg0BkP4IoPbn7PQebPNZY2p3Z7_3tq9Bm93MtvjTq8RQ7LoXTqg4jI8eRjeza5u87Pn_wMcZwQChQ_gsj9UxBx75_G8l4f2LpZ1_UrAya99X9adl0uyL35l301vXQBv87A86JdYjiCd1G9r6mkE-OcQsiG_JPMLWd2YuvCwWWa9j-e9W1PKt5muOllgYYxR15RJqsQsFG8jEb-GSSWddLtFaH1_vUPeq1JxlS_Z9QzUfj1da4KsrqFMnIdVK_x1_mAgFUgi8sVESWLTBphlldJnmgHAKtvpZXGZOMFtbqxCFh7vaiywn52SR1E5w-coq_8gRWplPv6PlQc7L5NTnHpO4x59xyMAEGIFGpvVqnQ_bNqxPLG_yeko7DQGaExHzGqTC2KGwuBfVW0skE0c1v0mn0FuQ7JqQtFPo7y3sFmbS5-THGAq08zkp8i16crvGWSPzx98_KnHViASq8Zmg39C9M4bsafBEkJslsU_lvBdVsW0_JgfdiOXG4oTbQSOokvilAEYQLLAF6ZPg263iKSMwHzLrdWinulnf5O2ts6lt3Chr6wUC_3_RZFHIN_AZfKkYgomcbAgk9Gq7pyv2PNtgwZ_-WxZP3_6jb6BH-oVv2TCbEQYGJlKtwUhf5IIP7-09BSAsIff91yRnMVUQV_uT2Zfkaub0lXMTQnL7tgjM6ActE6kwkKmnXHG78jhpeWRoTlBE-DiC__cd-UMymEa_WEIO6kNmiMUbiYT5BHPsTHN48Gs-NcUpvDlUVt5fey6ar_-VAL37roHgZ7BAtg7NEqr5LVsie8zoFaiN-vlRQ9nlT4s04hPF3s2xe6XL6o86C20_qZIzCMQSPsXUGchc2PFVycqPdal1nPKkweRM5UdtexTtAyWBO33zkiNUfSPgKM1rSJq4se1FA6DejwTRUl99vvgubitL2HVK6EAwvgt_gq5vgeIvhtOC19YeKkzE2ZlUV6rMVCsmBAghq1eqzn42KALmWIw-vJxYc8hhtmrpP2alxBrcG4fEE3jMRb0NGTAp25oQpM_Nxx4oyxsRj79Oz6YfAOWukuolBsRBgtYqiT6CvvVISN2nKj-iSZ81-TiZx-cYimtxee3lnyHCCijJsEzTQwDBHy8u_DZvnERS6RaGnV-33E2jjhROwu6LPmwirOnhrAjDPnbAMFEUkUXlcI92EkbRQqgxVz3kt_Ro8SLL8KuFtsjHZZttKUWTtpXtN1pQXwelWTLky_DYwiExDovrFK33w5Zu9hASFyfBsBfqfA-c21VDf1isNBHYcUvJuDkY2RwlMFinZWxCqh8pg2fei8EbVGvacE97-il-OTAY5P65ofxgDzvvqDQtiWo9rXyQUY2WXTYigToEInX743l5LFeUGWGvVwSkpZV6b4Ya8EsfVUlbb77MB8SGKdR9yfnaefkrnzQGls5c0u46nT5-IXr_2foTvYNrHrWZbbbbFF9Okd14F_FAwDtVku3suu-FfHJoxGyREg9pyjegGnAuy1OKW2PRSkl0l-cWW7rVNmU1nKR9g1lFXWmr14mIJtImBN2kh2eiIKcffPF8vam07_l_TsmyOjxeLiD-t4OTzNsLtajfQzX5fa2SR71YGUjyIoKhJYrgDJ_OKWcaz--yXEi_xRD-fQ_RIXQZzhKqBlGmPsc2r_soMQ3L_vgwgpbDNwWOfYwsVXwXhJqBPlC1DfHtFY2lWVpZedzPO-iJKR5j1I8peBhP2i9luawOTfqHktPqh3rCg7feqssd5_YszWJwpZAi_dojS-7AYtcLNasG3kiOIykA0_1HJjkhz22_aWFCtA.bt5QEMaYBIm2bKP93mb0Jw",
}

const createDocument = async (user) => {
  const startTime = new Date().getTime();
  await fetch("http://localhost:6543/attribute-compositions?clientId=" + user.clientId, {
    "headers": {
      "accept": "application/json",
      "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json",
      "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "http://localhost:3001/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "cookie": user.cookie,
    },
    "body": `{
      "documentCollaboratorGroup":{
        "type":"KeyValueAttribute",
        "value":{},
        "facts":[
          ["isDocumentCollaboratorGroupOf","{{content}}"],
          ["$canAccess","{{content}}"],
          ["$canReferTo","{{content}}"],
          ["$canAccess","{{documentConfig}}"],
          ["$canAccess","{{references}}"],
          ["$canAccess","{{usersActivityAttribute}}"]
        ]
      },
      "documentReaderGroup":{
        "type":"KeyValueAttribute",
        "value":{},
        "facts":[
          ["isDocumentReaderGroupOf","{{content}}"],
          ["$canReferTo","{{content}}"],
          ["$canRead","{{content}}"],
          ["$canRead","{{documentConfig}}"],
          ["$canRead","{{references}}"],
          ["$canRead","{{usersActivityAttribute}}"]
        ]
      },
      "usersActivityAttribute":{
        "type":"KeyValueAttribute",
        "value":{},
        "facts":[
          ["isA","userActivityState"],
          ["belongsTo","{{content}}"]
        ]},
        "content":{
          "type":"LongTextAttribute",
          "value":"<h1 id=\\"c227081c-5245-4dd2-81a6-d2632d5ea0d4\\"></h1><p></p>",
          "facts":[
            ["isA","documentContent"]
          ]
        },
        "myComments":{
          "type":"KeyValueAttribute",
          "value":{},
          "facts":[
            ["isA","documentCommentCollection"],
            ["belongsTo","{{content}}"]
          ]
        },
        "documentConfig":{
          "type":"KeyValueAttribute",
          "value":{},
          "facts":[["isA","documentConfig"],["belongsTo","{{content}}"]]},"references":{"type":"KeyValueAttribute","value":{},"facts":[["isA","referenceStore"],["belongsTo","{{content}}"]]},"referenceSources":{"type":"KeyValueAttribute","value":{},"facts":[["isA","referenceSourceStore"],["belongsTo","{{content}}"],["belongsTo","${user.id}"]]}}`,
    "method": "POST"
  });

  const endTime = new Date().getTime();

  return endTime - startTime;
}

const listDocument = async (user) => {
  const startTime = new Date().getTime();

  const query = {
    "documents":[
      ["$it","$hasDataType","KeyValueAttribute"],
      ["$it","isA","documentConfig"],
      ["$it","$latest(deletionStateIs)","$not(inTrashbin)"],
      ["$it","$latest(deletionStateIs)","$not(deleted)"],
      [user.id,"$isAccountableFor","$it"]
    ]
  };

  // const query = {
  //   "documents":[
  //     ["$it","$hasDataType","KeyValueAttribute"],
  //     ["$it","isA","documentConfig"],
  //     ["$it","$latest(deletionStateIs)","inTrashbin"],
  //     ["$it","$latest(deletionStateIs)","deleted"],
  //     [user.id,"$isAccountableFor","$it"]
  //   ]
  // };


  const result = await fetch("http://localhost:6543/attributes?query=" + encodeURIComponent(JSON.stringify(query)), {
    "headers": {
      "accept": "application/json",
      "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json",
      "if-none-match": "W/\"8cf-khysfz9EZhMrn4R5nuUKqGfevAc\"",
      "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "http://localhost:3001/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "cookie": user.cookie,
    },
    "body": null,
    "method": "GET"
  });

  const endTime = new Date().getTime();

  console.log('matches', (await result.json()).documents.length)

  return endTime - startTime;
}

// user 1, last 100 AVG 6200 489.37
// user 2 6200 274
// user 1, last 100 AVG 6300 503.94
// user 2 6300 291

// for (let index = 0; index < 10000; index++) {
//   times.createDocuments.push(await createDocument(user1));

//   if(index%100 === 0) {
//     console.log('user 1, last 100 AVG', index, avg(times.createDocuments));
//     times.createDocuments = [];
//     // const time = await createDocument(user2);
//     // console.log('user 2', index, time);
//   }
// }

// for (let i = 0; i < 10; i++) {
//   times.createDocuments.push(await createDocument(user2));
// }

// for (let i = 0; i < 10; i++) {
//   times.listDocuments.push(await listDocument(user2));
// }


times.listDocuments.push(await listDocument(user2));

console.log('Create Document AVG:', avg(times.createDocuments));
console.log('List Documents AVG:', avg(times.listDocuments));
console.log(times)
