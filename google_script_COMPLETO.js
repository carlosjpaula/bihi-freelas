function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Roteador de Ações: Salvar Configurações via Dashboard
    if (payload.action === "saveConfigs") {
      return saveConfigs(ss, payload.data);
    }
    
    // Caso contrário, prosseguir para o fluxo normal de Cadastro do Freelancer
    return registerFreelancer(ss, payload);
    
  } catch (error) {
    return formatJsonOutput({ status: "erro", mensagem: error.toString() });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e.parameter.action;
    
    if (action === "getConfigs") {
      return getConfigs(ss);
    }
    
    // Fluxo padrão: Listar Registros para o Dashboard
    let sheet = ss.getSheetByName("Registros");
    if (!sheet) sheet = ss.getActiveSheet();
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return formatJsonOutput([]);
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        obj[normalizeHeader(header)] = row[i];
      });
      return obj;
    });
    
    result.reverse();
    return formatJsonOutput(result);
    
  } catch (error) {
    return formatJsonOutput({ error: error.toString() });
  }
}

// ============================================
// 1. FLUXO DE CADASTRO DO FREELANCER
// ============================================
function registerFreelancer(ss, payload) {
  let sheet = ss.getSheetByName("Registros");
  if (!sheet) {
    sheet = ss.insertSheet("Registros");
  }
  
  // [INTELIGÊNCIA] Buscar Valor do Dia Baseado nas Configurações
  let valorPago = 0;
  const configuracoes = readConfigsInternal(ss);
  
  // Descobrir dia da semana (0=Domingo, 6=Sábado)
  const dataServidor = new Date();
  const diaSemana = dataServidor.getDay();
  const isFimDeSemana = (diaSemana === 0 || diaSemana === 6);
  
  // Achar a função nos configs
  const funcaoClean = payload.tipo.toString().toLowerCase();
  const match = configuracoes.find(c => c.funcao.toLowerCase() === funcaoClean);
  
  if (match) {
    valorPago = isFimDeSemana ? Number(match.valor_fimdesemana) : Number(match.valor_semana);
  }

  // Organizar Pastas no Drive
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const pastaDestino = getNestedFolder(["Planilhas", "FREELANCERS", meses[dataServidor.getMonth()] + "_" + dataServidor.getFullYear()]);
  
  // Salvar Arquivos
  let pdfUrl = "-";
  if (payload.pdfBase64) {
    const filePdf = pastaDestino.createFile(Utilities.newBlob(Utilities.base64Decode(payload.pdfBase64), 'application/pdf', "Contrato_" + payload.nome.replace(/\s+/g, "_") + ".pdf"));
    filePdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfUrl = filePdf.getUrl();
  }
  
  let photoUrl = "-";
  if (payload.photoBase64) {
    const filePhoto = pastaDestino.createFile(Utilities.newBlob(Utilities.base64Decode(payload.photoBase64.split(',')[1]), 'image/jpeg', "Selfie_" + payload.nome.replace(/\s+/g, "_") + ".jpg"));
    filePhoto.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = filePhoto.getUrl();
  }
  
  // Cabeçalho se vazio
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Data/Hora", "Nome", "CPF", "Tipo/Função", "Valor Diária (R$)", "Chave PIX", "Possui MEI?", "CNPJ", "Contrato", "Foto"]);
    sheet.getRange("A1:J1").setFontWeight("bold").setBackground("#d1d5db");
  }
  
  // Inserir
  sheet.appendRow([
    payload.dataHora, payload.nome, "'" + payload.cpf, payload.tipo, valorPago, payload.pix,
    payload.mei ? "SIM" : "NÃO", payload.cnpj || "-", pdfUrl, photoUrl
  ]);
  
  return formatJsonOutput({ status: "sucesso" });
}

// ============================================
// 2. SISTEMA DINÂMICO DE CONFIGURAÇÕES
// ============================================
function getConfigs(ss) {
  return formatJsonOutput(readConfigsInternal(ss));
}

function readConfigsInternal(ss) {
  let configSheet = ss.getSheetByName("Configuracoes");
  
  // Se não existir, criar com os padrões solicitados
  if (!configSheet) {
    configSheet = ss.insertSheet("Configuracoes");
    configSheet.appendRow(["Função", "Valor Semana (R$)", "Valor FimDeSemana (R$)"]);
    configSheet.appendRow(["Garçom", 100, 130]);
    configSheet.appendRow(["Cumim", 80, 100]);
    configSheet.appendRow(["Auxiliar de Serviços Gerais", 90, 110]);
    configSheet.appendRow(["Auxiliar de Cozinha", 100, 120]);
    configSheet.appendRow(["Cozinheiro", 150, 180]);
    configSheet.appendRow(["Entregador", 0, 0]);
    configSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#d1d5db");
  }
  
  const data = configSheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[normalizeHeader(h)] = row[i]);
    return obj;
  });
}

function saveConfigs(ss, newData) {
  let configSheet = ss.getSheetByName("Configuracoes");
  if (!configSheet) configSheet = ss.insertSheet("Configuracoes");
  
  configSheet.clear();
  configSheet.appendRow(["Função", "Valor Semana (R$)", "Valor FimDeSemana (R$)"]);
  configSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#d1d5db");
  
  newData.forEach(item => {
    configSheet.appendRow([item.funcao, item.valor_semana, item.valor_fimdesemana]);
  });
  
  return formatJsonOutput({ status: "sucesso" });
}

// ============================================
// UTILITÁRIOS
// ============================================
function getNestedFolder(pathArray) {
  let cur = DriveApp.getRootFolder();
  pathArray.forEach(name => {
    let folders = cur.getFoldersByName(name);
    cur = folders.hasNext() ? folders.next() : cur.createFolder(name);
  });
  return cur;
}

function normalizeHeader(s) {
  return s.toString().toLowerCase().trim()
    .replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óõô]/g, 'o').replace(/[ú]/g, 'u').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, ''); // Apenas letras e números
}

function formatJsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
