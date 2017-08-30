const VERSION = 2
const APISERVER = 'https://api.panlex.org'
const URLBASE = (VERSION === 2) ? APISERVER + '/v2' : APISERVER

function query(ep, params) {
  let url = URLBASE + ep
  return(fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  .then((response) => response.json()));
}

function getTranslations(txt, uidDe, uidAl, distance = 0) {
  let queryOne = {
    trans_uid: uidDe,
    uid: uidAl,
    trans_txt: txt,
    include: ['trans_quality', 'trans_txt'],
    sort: 'trans_quality desc',
  };
  let queryTwo = Object.assign({trans_distance: 2}, queryOne);
  return(query('/fallback', {requests: [
    {url: '/expr', query: queryOne},
    {url: '/expr', query: queryTwo},
  ]}).then(responseData => responseData.result))
}

function getMultTranslations(txtArray, uidDe, uidAl) {
  return(
    getTranslations(txtArray, uidDe, uidAl).then(
      (result) => {
        let output = {};
        let txtNotFound = [];
        for (let txt of txtArray) {
          let trnList = result.filter(trn => (trn.trans_txt === txt));
          if (trnList.length) {
            output[txt] = trnList;
          } else {
            txtNotFound.push(txt);
          }
        }
        return([output, txtNotFound])
      }
    ).then(
      ([output, txtNotFound]) => {
        if (txtNotFound.length) {
          return(
            getTranslations(txtNotFound, uidDe, uidAl).then(
              (result) => {
                for (let txt of txtNotFound) {
                  output[txt] = result.filter(trn => (trn.trans_txt === txt));
                }
                return(output);
              }
            )
          )
        } else {
          return(output)
        }
      }
    )
  )
}

export { query, getTranslations, getMultTranslations }