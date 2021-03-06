const router = require("express").Router();
const request = require('request');
const puppeteer = require('puppeteer');
const { PromisePool } = require('@supercharge/promise-pool')

router.post(
  '/sandbox',
  async (req, res, next) => {
    const { processes } = req.body
    res.json(processes);
    
    let browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    
    var [ page ] = await browser.pages();
  
  
    // var popup = await browser.on('targetcreated', async(target) => {
    // 	return await target.page();
    // });
  
    for (var i = 0; i < processes.length; i++) 
    {
      var process_num = processes[i].process_num;
      
      await page.goto("http://127.0.0.1/sandbox/index.html#");
  
      await page.waitForSelector(".list-group-item") // fazer timeout
  
      await page.evaluate(() => {
        document.querySelector(".list-group-item").click()
      })
  
      const newPagePromise = new Promise(x => browser.once('targetcreated', target => x(target.page()))); 
      const newPage = await newPagePromise;           // open new tab /window, 
      await newPage.waitForTimeout(5000).then(() => console.log('Waited a second!'));
  
      await newPage.close();
    }
  
  
  });
  
  
  // coletar processo individual
  router.post(
  "/coleta",
  async (req, res, next) => {
    
    let browser = await puppeteer.launch({
      args: [
        '--window-size=1280,768',
      ],
      headless: false,
    })
    
    const page = await browser.newPage()
    
    await page.setViewport({
      width: 0,
      height: 0,
    })
  
    const url = 'https://pje1g.tjrn.jus.br/consultapublica/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?ca=3f7e3b24aa79de45d154ac2ff2684f554eb45dce8f4f96f4'
  
    await page.goto(url)
  
    await page.waitForNetworkIdle();
  
    var ativo = await page.evaluate(() => {
      let data = {
        public_url: window.location.href,
        polo_ativo: [], 
        polo_passivo: [] 
      };
  
      // coletar polo ativo
      let ativo_table = document.querySelector("#j_id130\\:processoPartesPoloAtivoResumidoList\\:tb");
      for( var rowId = 0; rowId < ativo_table.rows.length; rowId++ ){
        var text = ativo_table.rows.item(rowId).innerText
        var pattern = /^.*(?=( - CNPJ:))|^.*(?=( - CPF:))|^.*(?=( [(]AUTOR))/gm;
        var autor = text.match(pattern)[0];
        var documentPattern = /([0-9]{2}[\.]?[0-9]{3}[\.]?[0-9]{3}[\/]?[0-9]{4}[-]?[0-9]{2})|([0-9]{3}[\.]?[0-9]{3}[\.]?[0-9]{3}[-]?[0-9]{2})/gm;
        var documento = text.match(documentPattern);
        documento = (documento) ? documento[0] : "N??o tem";
        if(!text.includes("ADVOGADO")){
          data.polo_ativo.push({nome: autor, documento: documento});
        }
      }
  
  
      let passivo_table = document.querySelector("#j_id130\\:processoPartesPoloPassivoResumidoList\\:tb");
      for( var rowId = 0; rowId < passivo_table.rows.length; rowId++ ){
        var text = passivo_table.rows.item(rowId).innerText
        var pattern = /^.*(?=( - CNPJ:))|^.*(?=( - CPF:))|^.*(?=( [(]AUTOR))/gm;
        var autor = text.match(pattern)[0];
        var documentPattern = /([0-9]{2}[\.]?[0-9]{3}[\.]?[0-9]{3}[\/]?[0-9]{4}[-]?[0-9]{2})|([0-9]{3}[\.]?[0-9]{3}[\.]?[0-9]{3}[-]?[0-9]{2})/gm;
        var documento = text.match(documentPattern);
        documento = (documento) ? documento[0] : "N??o tem";
        if(!text.includes("ADVOGADO")){
          data.polo_passivo.push({nome: autor, documento: documento});
        }
      }
  
      return data;
    })
    console.log(ativo)
  
  })
  
  
  // gather
  router.post(
    '/gather',
    async (req, res, next) => {
      const { processes } = req.body
      res.json(processes);
      
      let browser = await puppeteer.launch({
        args: [
          '--window-size=1280,768',
        ],
        headless: false,
      })
      
      const page = await browser.newPage()
      
      await page.setViewport({
        width: 0,
        height: 0,
      })
  
      for (let i = 0; i < processes.length; i++) 
      {
        await page.goto(processes[i].url);
        // await page.waitForNetworkIdle();
        const options = await page.$$eval('#j_id130\\:processoEvento\\:tb > tr > td:first-child', (options) =>
          options.map((option) => option.innerText.replace(/(\r\n|\n|\r)/gm, ""))
        );
        console.log(options)
        // for ( let row = 0; row < rows.length; row++ ) {
        // 	console.log(rows.item(row).innerText)
        // }
      }
  
  
    }
  )
  
  router.post(
    "/processes", 
    async (req, res, next) => {
      const { ROUTER_ID, JSESSIONID, oab_num, oab_sufix, oab_uf } = req.body
      
      res.send("Sua requisi????o foi feita com sucesso, assim que terminamos devolvemos ao servidor");
  
      let browser = await puppeteer.launch({
        args: [
          '--window-size=1280,768',
        ],
        headless: false,
      })
      
      const page = await browser.newPage()
      
      await page.setViewport({
        width: 0,
        height: 0,
      })
      
      const default_domain = 'pje1g.tjrn.jus.br'
      const url = 'https://pje1g.tjrn.jus.br/pje/Processo/ConsultaProcesso/listView.seam'
  
      const cookies = [
        { name: "ROUTER_ID", value: ROUTER_ID,	domain: default_domain,	path: "/", expire: "Session",	secure: true },
        { name: "JSESSIONID", value: JSESSIONID, domain: default_domain, path: "/pje", expire: "Session" }
      ]
      
      await page.setCookie(...cookies)
      await page.goto(url)
      // se n??o existir nenhuma tabela, ele retorna
      try {
        await page.waitForSelector('[name="fPP:decorationDados:numeroOAB"]', {timeout: 2000})
      } catch (error) {
        await browser.close();
        console.error("O token informado expirou");
        return;
      }
      // await page.type('[name="fPP:j_id138:nomeParte"]', "ramon isaac saldanha de azevedo e silva", {delay: 10});
      await page.type('[name="fPP:decorationDados:numeroOAB"]', oab_num, {delay: 10});
      await page.type('[name="fPP:decorationDados:letraOAB"]', oab_sufix, {delay: 10});
      await page.type('[name="fPP:decorationDados:ufOABCombo"]', oab_uf, {delay: 10});
  
      await page.keyboard.press('Enter') // fazer consulta
      await page.waitForResponse(response => response.status() === 200) // aguardar a resposta da consulta
                .then(() => console.log('Pagina de consulta 0 carregada'))
      await page.waitForNetworkIdle();
      
  
      // se n??o existir nenhuma tabela, ele retorna
      try {
        await page.waitForSelector(".rich-table-row", {timeout: 2000})
      } catch (error) {
        await browser.close();
        console.error("Nenhum processo encotrado");
        return;
      }
  
      // capturar primeira p??gina
      var processes = await page.evaluate(()=>{
        let data = [];
        let table = document.querySelector("#fPP\\:processosTable")
        for( var rowId = 1; rowId < table.rows.length; rowId++ ){
          let objCells = table.rows.item(rowId).cells;
  
          let values = new Object;
  
          for( var columnId = 0; columnId < objCells.length; columnId++ ) {
  
            const columnName = {
              0: "n_processo",
              1: "caracteristicas",
              2: "orgao_julgador",
              3: "autuado_em",
              4: "classe_judicial",
              5: "polo_ativo",
              6: "polo_passivo",
              7: "ultima_movimento"
            };
  
            let text = objCells.item(columnId).innerText;
            let title = columnName[columnId];
            values = Object.assign(values, {[columnName[columnId]]: text})
          }
          data.push(values)
        }
        return data.slice(0, -1); // exclui a ultima coluna (desnecess??ria)
      });
  
  
      // S?? tem uma p??gina, mas tem processos
      try {
        await page.waitForSelector(".rich-datascr-inact", {timeout: 2000})
      } catch (error) {
        // await browser.close();
  
        // FAZER REQUEST CURL NO CALLBACK AQUI
        // return res.send(processes); // se tiver processos mas s?? uma p??gina, ele termina
        console.log(processes.length);
      }
  
      // const countPages = await page.$$eval('.rich-datascr-inact', (pags) => pags.length)
      const countPages = await page.evaluate(()=>{
        let countProcesses = document.querySelector("#fPP\\:processosTable\\:j_id445 > div.pull-right > span").innerText.replace(/([^\d])+/gim, '');
  
        return Math.floor(countProcesses / 20);
      })
  
      for (var i = 0; i < countPages; i++ ) {
  
        await page.waitForSelector(".rich-datascr-button");
        await page.evaluate(() => {
          return document.querySelectorAll(".rich-datascr-button")[4].click()
        })
  
        await page.waitForResponse(response => response.status() === 200)
        .then(() => console.log(`Pagina de consulta ${i+1} carregada`)) // aguardar a resposta da consulta
  
        await page.waitForNetworkIdle();
  
        var anotherPage = await page.evaluate(()=> {
          let data = [];
          let table = document.querySelector("#fPP\\:processosTable");
          for( var rowId = 1; rowId < table.rows.length; rowId++ ){
            let objCells = table.rows.item(rowId).cells;
    
            let values = new Object;
    
            for( var columnId = 0; columnId < objCells.length; columnId++ ) {
    
              const columnName = {
                0: "n_processo",
                1: "caracteristicas",
                2: "orgao_julgador",
                3: "autuado_em",
                4: "classe_judicial",
                5: "polo_ativo",
                6: "polo_passivo",
                7: "ultima_movimento"
              };
    
              let text = objCells.item(columnId).innerText;
              let title = columnName[columnId];
              values = Object.assign(values, {[columnName[columnId]]: text})
            }
            data.push(values)
          }
          return data.slice(0, -1); // exclui a ultima coluna (desnecess??ria)
        });
  
        processes = [...processes, ...anotherPage]
      }
      
      console.log(processes);
  
      await browser.close();
      // res.send( processes )
    });
    // document.getElementById('fPP:searchProcessos').click()
  
  module.exports = router;