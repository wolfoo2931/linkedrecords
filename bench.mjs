
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

const user2 = {
  id: 'us-0a3f0f0024eeebda95a3413ebf8bb23d',
  clientId: '218c5999-544d-4f42-b97b-214e4f27f8da',
  cookie: "userId=s%3Aus-0a3f0f0024eeebda95a3413ebf8bb23d.7zU7tB0QW%2FuBqHG2TFWukw31mC1wrwNHbsW5cUQT%2Fhg; appSession=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwiaWF0IjoxNzMyNTI1MDk4LCJ1YXQiOjE3MzI1MjUxMDAsImV4cCI6MTczMjYxMTUwMH0..0cacVBuxqT-T67HP.3iiUxYUTDO-pLhqDv9dMc59O0UFqDGtruYhetn0ewnWvlvbmvdfYKf6fZZFuFYBMzJ2y9QlFoXud2oZkz63E5pw0uIh9H3jzhY5yqqaceGlkg3x64oD2xlr9cU4OZePP-UWpWxvjQ7PpT5OrjnvnQDykr9xVZAdIhE0Fhe0Sy9J4kgCz8lnNGq9ibe7QJrCG0TbfLo6FtNYPDDbUj4ArY6VyBNlnaUQRxcWUS_A6N6l319IoaxUjpFsIxbS6gGqjSDnXPuaBoNw8XQkULNLd-0Y3rHGZfRph20pXG45SkUBnrzcGxSA_qrlg0O_c-Wyy-osBgTlSbPyh6PfsZ7kLLaHCbk1UgyQ9NK1BNWq69U5AiBvBM4H45sfYsroGFAafvFNFACCSBrPa4crCcprTXcUz4kaCjEUkfVnR8BrLN2mxSl3WAAK9WHvGdfyd2E5FR0xWtoNs1SmPtlhYRpSt7hnmuQu2gcRde035-gnOlrkNbRu3nt5Eh_r4Tzmhm4FuZaTNViJ-hgmi7HHKzhmDZCNXvqDTs_UUmGReIU34n3XwzLGwNXg9jGAaE2-UIVQg4KKpiXolkSwnDgnqjmRaStbgd6rWKQ_tyYBmeo6dnP4JatlBuGrPG3y2hAvZ60riqbZeisPx34rib1LWGGu3lOvcsDuoOj3MZyrRZC9j1QFPO6IK2iBywpIQkQEiU_WENAsNUDvvLitpdUJq6h4rUuKeUNSLJJcfiWSzhQ2HccVd0aPiwxHSMHhg5XjrAvstfct59bvbVeqpo1Ndxz1PbN75wjIvxcSw5vdnL1kF9hMAlFlPve7t5cncv88KjY7E1c3ErUskIh-CA8ACjyY-lr1QuOWQV6hWdkqDfzjB3XE6tInMzif5OLTgFIHbUMqJonCiPJB7HvxUELLqnt54Qz6JccjTXpLJwtPXhcGCItPXajvNzjUyX6eDNOkjxIoq7blRBvqX6rI-nwjmyd4qDphFkdrTN2euRKoZ4g0GQ3xEaNnfA43cxRQ4_90wxrVtNRdomZ7e6q3sLOEh3_CYmeQlrAHfg47BMUR3OQb4bEfRjgzMnUnkyurUdqlcjmFzCrAyUOQRsq-LTM7np4ejCncMb_MAVfWd6AYEcA9t5nyqx7NkG58TGLIWXIJCvAEmRock5na-1QFw3nR2MFtS4Y1PyM5qUDuTIdzsdEkJ-kFX5Sb_5VrGt1nW-tchLSeYJA7Rkwtcs42Y-fgwWH7K_4xcpGL_x-y7gicIAhxRwgtfk7J-ykxwDzBIKHAPpUiBDbjPBVnj8_sqx8vGyRNiWqZkKI6ZITVUvMApjTn8AEfsIULyBQpJCfEUA-QDxb-GzMHvrMIY_93tJny7Ga7SsaAh774KBYWcO6mg0TEIhbVrzFfNvAXQLBbsFkHbcm9Z5NZoFqIogIonLrSfWjnOMnuriN7fDYs6nQMr1HD7v317b26Fj-RtSuCosTpS5VnGuS4O8S4zRfjRJVyXr9cmfzBzSsIvy9ktgUcVtWsWWHzmjBAJuP5YKZU-WXF_2X7RojUm9lm-IgXyMQB38N9V1k8krn3ESbjvvzb8meWnEFEiaBNZfezRO2aFULvIVD_acHg7NCaUF3p-fmSe17GUuJrEccWl14GYleKnwJ04_8M43369ZLeBbOdNl9BPnWO5bkqokd4lHKxiZ_1s67IcdLEvXI99u48VzzmWQfmqc-RJvvK40lmbo2Nq5-1zm7QilS5eImzcbznecwJ-Boc69B2aTSfQ-Lni6ORncQn5Lv9qGQyDpHAIHHWNBSMNxPKY228R26_JLz5isON2Xm8EGSPgvYHs1fkub44X3TT7l5o3-hhdHfLAffcTX1oIgCrR7Ubbu0hvAZClTLK96B4-VDGGLFuoQUOpJ20i4L6FTXILMIgSs_lV8m-eGY1syTmbbw9Z-kY9tqTJNcQdeEmjXAUcprz7bvfRph0rp1rk0IWSJzh37ARATl2WhBe4io2JvUzkRf4SRspN521seL_EvP58uwzcJe2usC3oey_WFW4u0Mf0b6nXJbhmU9vJ9x5Z5mN-yF1wsasCuvidjj0tRS7Qa-Po5iEKdWeD5X_4uRuAMJzSpFgage_Oobzrr8K6f8wRIIPSKV1kfGZqXcGYmoqdfJ4MVLahHc6PuQ.PA5lS1BjP2v4lvlS4YnUxg",
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
  const result = await fetch("http://localhost:6543/attributes?query=%7B%22documents%22%3A%5B%5B%22%24it%22%2C%22%24hasDataType%22%2C%22KeyValueAttribute%22%5D%2C%5B%22%24it%22%2C%22isA%22%2C%22documentConfig%22%5D%2C%5B%22%24it%22%2C%22%24latest%28deletionStateIs%29%22%2C%22%24not%28inTrashbin%29%22%5D%2C%5B%22%24it%22%2C%22%24latest%28deletionStateIs%29%22%2C%22%24not%28deleted%29%22%5D%2C%5B%22" + user.id + "%22%2C%22%24isAccountableFor%22%2C%22%24it%22%5D%5D%7D", {
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
//     const time = await createDocument(user2);
//     console.log('user 2', index, time);
//   }
// }

// for (let i = 0; i < 10; i++) {
//   times.createDocuments.push(await createDocument());
// }


for (let i = 0; i < 10; i++) {
  times.listDocuments.push(await listDocument(user2));
}


console.log('Create Document AVG:', avg(times.createDocuments));
console.log('List Documents AVG:', avg(times.listDocuments));
console.log(times)
