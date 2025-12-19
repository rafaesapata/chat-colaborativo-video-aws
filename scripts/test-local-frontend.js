#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testLocalFrontend() {
  console.log('🧪 Testando frontend local em http://localhost:3000');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // Para ver o que está acontecendo
      devtools: true,  // Abrir DevTools
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capturar logs do console
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
    });
    
    // Capturar erros
    page.on('pageerror', error => {
      console.error(`[BROWSER ERROR] ${error.message}`);
    });
    
    // Capturar falhas de requisição
    page.on('requestfailed', request => {
      console.error(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
    });
    
    console.log('📱 Abrindo página inicial...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Aguardar um pouco para ver os logs iniciais
    await page.waitForTimeout(2000);
    
    console.log('🏠 Testando página inicial...');
    
    // Verificar se a página carregou
    const title = await page.title();
    console.log(`📄 Título da página: ${title}`);
    
    // Verificar se o botão "Criar Nova Sala" existe
    const createRoomButton = await page.$('button:has-text("Criar Nova Sala")');
    if (createRoomButton) {
      console.log('✅ Botão "Criar Nova Sala" encontrado');
    } else {
      console.log('❌ Botão "Criar Nova Sala" não encontrado');
    }
    
    // Clicar no botão para criar uma sala
    console.log('🔘 Clicando em "Criar Nova Sala"...');
    await page.click('button');
    
    // Aguardar navegação
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    console.log('🏠 URL atual:', page.url());
    
    // Aguardar um pouco para ver os logs da sala
    await page.waitForTimeout(5000);
    
    console.log('✅ Teste concluído! Deixando o navegador aberto para inspeção...');
    
    // Não fechar o navegador para permitir inspeção manual
    // await browser.close();
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    if (browser) {
      await browser.close();
    }
  }
}

// Verificar se o Puppeteer está instalado
try {
  require('puppeteer');
  testLocalFrontend();
} catch (error) {
  console.log('📦 Puppeteer não encontrado. Instalando...');
  console.log('Execute: npm install puppeteer');
  console.log('Ou teste manualmente em: http://localhost:3000');
}