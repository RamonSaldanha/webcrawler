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

async function resolve_captcha(api_key, captcha_type, site_key, site_url) {

	let unparsed_captcha_id = await curl({
		method : 'POST',
		url: `https://2captcha.com/in.php`,
		form: {
				key: api_key,
				method: captcha_type,
				json: true,
				sitekey: site_key,
				// o site key é encontrado no código fonte da página onde encontra-se o HCaptcha
				pageurl: site_url,
				invisible: 1
		}
	});
	
	let parsed_captcha_id = JSON.parse(unparsed_captcha_id);

	let captcha_id = parsed_captcha_id.request;

	let i = 1;

	while(1) {
		await sleep(8)

		console.log("Tentativa " + i)

		let captcha_ready = await curl({
				method: 'GET',
				url: `https://2captcha.com/res.php?key=105510d6e6514581d91138a7d3b1a3c9&action=get&id=${captcha_id}&json=true`
		});

		let parsed_captcha_ready = JSON.parse(captcha_ready);
		
		if(parsed_captcha_ready.status == 1) {
			console.log("- Captcha resolvido ❤️");
			return parsed_captcha_ready.request;
		} else if(parsed_captcha_ready.request != "CAPCHA_NOT_READY") {
			console.log("CAPTCHA NÃO ESTÁ PRONTO - provavelmente o 2captcha está sem créditos");
			return false;
		}

		i++;
	}

}

async function gathering ( browser, page, process_num ) {

	try {
		await page.$eval('[name="fPP:numProcesso-inputNumeroProcessoDecoration:numProcesso-inputNumeroProcesso"]', (el, process_num) => el.value = process_num, process_num);
	} catch (e) {
		throw "Erro ao preencher o campo de número do processo";
	}

	const site_url = await page.evaluate(() => location.href);

	try {
		var site_key = await page.evaluate(() => document.querySelector(".g-recaptcha").getAttribute('data-sitekey'));
	} catch (e) {
		throw "Erro ao obter o site key do captcha";
	}

	var captcha_response = await resolve_captcha(
		"105510d6e6514581d91138a7d3b1a3c9", // api_key
		"hcaptcha", // captcha_type
		site_key, // site_key
		site_url // site_url
	);

	await page.waitForSelector('[name="g-recaptcha-response"]')
	
	await page.evaluate((captcha_response) => {
		document.querySelector('[name="g-recaptcha-response"]').value = captcha_response;
		document.querySelector('[name="h-captcha-response"]').value = captcha_response;
		onSubmit();
	}, captcha_response)

	// LEGADO
	// esse método serve para abrir o popup e a partir do popup pegar os dados
	// HABILITAR AQUI POR PADRÃO - NÃO FUNCIONA SEM HEADLESS
	// necessário para contornar erro de headless true
	// await page.waitForSelector(".rich-table-cell > a") // fazer timeout
	// await page.evaluate(() => {
	// 	document.querySelector(".rich-table-cell > a").click()
	// })
	// const popupPromise = new Promise(x => browser.once('targetcreated', target => x(target.page()))); 
	// const popup = await popupPromise; // open new tab /window,

	try {
		await page.waitForSelector(".rich-table-cell > a");
	} catch ( e ) {
		throw "process_not_found";
	}


	const parameterValue = await page.$eval('.rich-table-cell > a', el => el.getAttribute('onclick'));
	// print openPopUp('Consulta pública','/consultapublica/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?ca=e0754e852dfd536c6d16790bc31461226aa16c4755d69f27')


	const hostname = await page.evaluate(() => location.origin);
	// print https://pje1gconsulta.tjrn.jus.br

	let url = parameterValue.split("'")[3];
	// print /consultapublica/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?ca=e0754e852dfd536c6d16790bc31461226aa16c4755d69f27

	await page.goto(hostname + url)

	// para usar o método padrão sem utilizar headless, é preciso mudar a variavel "page" pela variavel "popup"
	// await page.screenshot({ path: 'page.png', fullPage: true })
	try {
		await page.waitForNetworkIdle();
	} catch (e) {
		throw "Erro ao esperar o carregamento da página";
	}

	try {
		var data = await page.evaluate(() => {
	
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
	} catch (e) {
		throw "Erro ao obter dados da página";
	}

	console.log(data);

	// await page.close();

}

// consulta
router.post(
	"/consulta",
	async (req, res, next) => {
		const { processes } = req.body

		res.send("Sua requisição foi feita com sucesso, assim que terminamos devolvemos ao servidor");

		// cloud
		let browser = await puppeteer.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		})
		
		// local
		// let browser = await puppeteer.launch({
		// 	args: [
		// 		'--start-maximized',
		// 	],
		// 	headless: true,
		// })
		
		var [ page ] = await browser.pages();

		
		// const url = 'https://pje.tjpb.jus.br/pje/ConsultaPublica/listView.seam'
		const url = 'https://pje1gconsulta.tjrn.jus.br/consultapublica/ConsultaPublica/listView.seam'


		// LOOP A PARTIR DAQUI
		// // resolve
		var start = Date.now();

		for (var i = 0; i < processes.length; i++)
		{
			await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
			
			try {
				await page.goto(url)
			} catch (e) {
				console.log("Houve algum erro ao acessar a página de consulta", e);
				await new Promise(resolve => setTimeout(resolve, 5000 * 3));
				// se houver algum erro, o sistema vai esperar um pouco e tentar novamente
				i--;
			}

			console.log("- A página de consulta foi acessada");

			// await page.screenshot({ path: 'consulta.png', fullPage: true });
			try {
				await gathering(browser, page, processes[i].process_num);
			} catch (error) {
				console.log(processes[i].process_num, error)
				// print 0807218-08.2021.8.20.5004 Erro ao preencher o campo de número do processo

				// se o processo não for encontrado no tribunal, ele vai continuar em outros processos
				if( error != "process_not_found" ) {
					await new Promise(resolve => setTimeout(resolve, 5000 * 3));
					// se houver algum erro, o sistema vai esperar um pouco e tentar novamente
					i--;
				}

			}

			

		}

		var end = Date.now();

		console.log(`- Tempo de execução: ${ end - start }ms 👍 ⌛`);

		console.log("- Todas consultas foram feitas ❤️");

		await browser.close();

	}
)

module.exports = router;