const router = require("express").Router();
const request = require('request');
const puppeteer = require('puppeteer');
const { PromisePool } = require('@supercharge/promise-pool')

async function curl(options) {
	return new Promise((resolve, reject) => {
			request(options, (err, res, body) => {
					if(err)
							return reject(err);
					resolve(body);
			});
	});
}

async function sleep(sec) {
	return new Promise((resolve, reject) => {
			setTimeout(function() {
					resolve();
			}, sec * 1000);
	});
}

async function resolve_captcha(site_key, site_url) {

	let unparsed_captcha_id = await curl({
		method : 'POST',
		url: `https://2captcha.com/in.php`,
		form: {
				key: "105510d6e6514581d91138a7d3b1a3c9",
				method: 'hcaptcha',
				json: true,
				sitekey: "25e80be5-15b5-45bc-aafc-7f4edcf9cf3e",
				pageurl: "https://pje1g.tjrn.jus.br/consultapublica/ConsultaPublica/listView.seam",
				invisible: 1
		}
	});
	
	let parsed_captcha_id = JSON.parse(unparsed_captcha_id);

	let captcha_id = parsed_captcha_id.request;


	while(1) {
		await sleep(10)
		console.log("VERIFICANDO")

		let captcha_ready = await curl({
				method: 'GET',
				url: `https://2captcha.com/res.php?key=105510d6e6514581d91138a7d3b1a3c9&action=get&id=${captcha_id}&json=true`
		});

		let parsed_captcha_ready = JSON.parse(captcha_ready);
		
		if(parsed_captcha_ready.status == 1) {
			console.log("CAPTCHA RESOLVIDO");
			return parsed_captcha_ready.request;
		} else if(parsed_captcha_ready.request != "CAPCHA_NOT_READY") {
			console.log("CAPTCHA NÃO ESTÁ PRONTO - provavelmente o 2captcha está sem créditos");
			return false;
		}

	}

}

async function gathering ( browser, page, process_num ) {
	
	await page.$eval('[name="fPP:numProcesso-inputNumeroProcessoDecoration:numProcesso-inputNumeroProcesso"]', (el, process_num) => el.value = process_num, process_num);

	// existe a possibilidade de aparecer um erro por 
	var captcha_response = await resolve_captcha();

	await page.waitForSelector('[name="g-recaptcha-response"]')
	
	await page.evaluate((captcha_response) => {
		document.querySelector('[name="g-recaptcha-response"]').value = captcha_response;
		document.querySelector('[name="h-captcha-response"]').value = captcha_response;
		onSubmit();
	}, captcha_response)

	// verificar se não existe botão
	// verificar timeout
	await page.waitForSelector(".rich-table-cell > a") // fazer timeout

	await page.evaluate(() => {
		document.querySelector(".rich-table-cell > a").click()
	})
 
	const popupPromise = new Promise(x => browser.once('targetcreated', target => x(target.page()))); 
	const popup = await popupPromise; // open new tab /window, 
	await popup.waitForNetworkIdle();

	var data = await popup.evaluate(() => {

		let data = {
			public_url: window.location.href,
			polo_ativo: [], 
			polo_passivo: [],
			movimentacoes: []
		};

		let ativo_table = document.querySelector("#j_id130\\:processoPartesPoloAtivoResumidoList\\:tb");
		for( var rowId = 0; rowId < ativo_table.rows.length; rowId++ ){
			var text = ativo_table.rows.item(rowId).innerText
			var pattern = /^.*(?=( - CNPJ:))|^.*(?=( - CPF:))|^.*(?=( [(]AUTOR))/gm;
			var autor = text.match(pattern)[0];
			var documentPattern = /([0-9]{2}[\.]?[0-9]{3}[\.]?[0-9]{3}[\/]?[0-9]{4}[-]?[0-9]{2})|([0-9]{3}[\.]?[0-9]{3}[\.]?[0-9]{3}[-]?[0-9]{2})/gm;
			var documento = text.match(documentPattern);
			documento = (documento) ? documento[0] : "Não tem";
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
			documento = (documento) ? documento[0] : "Não tem";
			if(!text.includes("ADVOGADO")){
				data.polo_passivo.push({nome: autor, documento: documento});
			}
		}

		let mov_table = document.querySelectorAll("#j_id130\\:processoEvento\\:tb > tr > td:first-child");

		for ( var rowId = 0; rowId < mov_table.length; rowId++) {
				var content = mov_table.item(rowId).innerText.replace(/(\r\n|\n|\r)/gm, "");
				data.movimentacoes.push({texto: content});
		}

		return data;
	})

	console.log(data);

	await popup.close();

}

// consulta
router.post(
	"/consulta",
	async (req, res, next) => {
		const { processes } = req.body

		res.send("Sua requisição foi feita com sucesso, assim que terminamos devolvemos ao servidor");

		// cloud
		// let browser = await puppeteer.launch({
		// 	args: ['--no-sandbox', '--disable-setuid-sandbox'],
		// })
		
		// local
		let browser = await puppeteer.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			// headless: false,
		})
		
		var [ page ] = await browser.pages();

		
		const url = 'https://pje1gconsulta.tjrn.jus.br/consultapublica/ConsultaPublica/listView.seam'


		// LOOP A PARTIR DAQUI
		// // resolve
		
		for (var i = 0; i < processes.length; i++)
		{
			await page.goto(url)

			// console.log(index)
			await gathering(browser, page, processes[i].process_num);
		}
	
		
		console.log("TODOS FORAM CONSULTADOS")

		await browser.close();

	}
)

module.exports = router;