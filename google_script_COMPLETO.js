function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById("1MgSAMk6AfOuyGS_NU_czhV0pvabuWrXN0Eze6OjnnNs");
    
    let sTmp = ss.getSheetByName("Registros");
    if (sTmp) {
      if (sTmp.getRange(1, 11).getValue() === "") sTmp.getRange(1, 11).setValue("Status Pagamento");
      if (sTmp.getRange(1, 12).getValue() === "") sTmp.getRange(1, 12).setValue("Comprovante Pix");
    }
    
    // Roteador de Ações
    if (payload.action === "saveConfigs") {
      return saveConfigs(ss, payload.data);
    }
    if (payload.action === "uploadComprovante") {
      return uploadComprovante(ss, payload);
    }
    if (payload.action === "updatePaymentStatus") {
      return updatePaymentStatus(ss, payload);
    }
    if (payload.action === "deleteFreelancer") {
      return deleteFreelancer(ss, payload);
    }
    
    // Caso contrário, prosseguir para o fluxo normal de Cadastro do Freelancer
    return registerFreelancer(ss, payload);
    
  } catch (error) {
    return formatJsonOutput({ status: "erro", mensagem: error.toString() });
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById("1MgSAMk6AfOuyGS_NU_czhV0pvabuWrXN0Eze6OjnnNs");
    const action = e.parameter.action;
    
    if (action === "getConfigs") {
      return getConfigs(ss);
    }
    
    // Fluxo padrão: Listar Registros para o Dashboard
    let sheet = ss.getSheetByName("Registros");
    if (!sheet) sheet = ss.getActiveSheet();
    
    if (sheet.getRange(1, 11).getValue() === "") sheet.getRange(1, 11).setValue("Status Pagamento");
    if (sheet.getRange(1, 12).getValue() === "") sheet.getRange(1, 12).setValue("Comprovante Pix");
    
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
  const nomeMes = meses[dataServidor.getMonth()];
  const diaCorrenteNum = dataServidor.getDate();
  const diaCorrente = diaCorrenteNum < 10 ? "0" + diaCorrenteNum : String(diaCorrenteNum);
  
  // Salvar Arquivos
  let pdfUrl = "-";
  if (payload.pdfBase64) {
    const pastaContratos = getNestedFolder(["Contratos", nomeMes, diaCorrente]);
    const filePdf = pastaContratos.createFile(Utilities.newBlob(Utilities.base64Decode(payload.pdfBase64), 'application/pdf', "Contrato_" + payload.nome.replace(/\s+/g, "_") + ".pdf"));
    filePdf.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdfUrl = filePdf.getUrl();
  }
  
  let photoUrl = "-";
  if (payload.photoBase64) {
    const pastaFotos = getNestedFolder(["Fotos", nomeMes, diaCorrente]);
    const filePhoto = pastaFotos.createFile(Utilities.newBlob(Utilities.base64Decode(payload.photoBase64.split(',')[1]), 'image/jpeg', "Selfie_" + payload.nome.replace(/\s+/g, "_") + ".jpg"));
    filePhoto.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = filePhoto.getUrl();
  }
  
  // Cabeçalho se vazio ou incompleto (migração automática)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Data/Hora", "Nome", "CPF", "Tipo/Função", "Valor Diária (R$)", "Chave PIX", "Possui MEI?", "CNPJ", "Contrato", "Foto", "Status Pagamento", "Comprovante Pix"]);
    sheet.getRange("A1:L1").setFontWeight("bold").setBackground("#d1d5db");
  } else if (sheet.getLastColumn() < 12) {
    sheet.getRange(1, 11).setValue("Status Pagamento");
    sheet.getRange(1, 12).setValue("Comprovante Pix");
    sheet.getRange("A1:L1").setFontWeight("bold").setBackground("#d1d5db");
  }
  
  // Inserir
  sheet.appendRow([
    payload.dataHora, payload.nome, "'" + payload.cpf, payload.tipo, valorPago, payload.pix,
    payload.mei ? "SIM" : "NÃO", payload.cnpj || "-", pdfUrl, photoUrl, "Pendente", "-"
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
  // Acessa a pasta raiz fornecida pelo usuário por ID
  let cur = DriveApp.getFolderById("1ldBUclQF6QOL7qaiz4LtuqKQ2L9fP-A-");
  
  // Cria ou abre as subpastas sequencialmente
  pathArray.forEach(name => {
    let folders = cur.getFoldersByName(name);
    cur = folders.hasNext() ? folders.next() : cur.createFolder(name);
  });
  
  return cur;
}

function normalizeHeader(s) {
  return s.toString().toLowerCase().trim()
    .replace(/r\$/g, 'rs')
    .replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óõô]/g, 'o').replace(/[ú]/g, 'u').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, ''); // Apenas letras e números
}

function formatJsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// SISTEMA DE GESTÃO DE PAGAMENTOS (DASHBOARD)
// ============================================
function uploadComprovante(ss, payload) {
  let sheet = ss.getSheetByName("Registros");
  if (!sheet) return formatJsonOutput({ status: "erro", mensagem: "Aba Registros não encontrada" });
  
  const rowIndex = findRowIndex(sheet, payload.cpf, payload.dataHora);
  if (rowIndex === -1) {
    return formatJsonOutput({ status: "erro", mensagem: "Freelancer não encontrado na planilha" });
  }
  
  // Salvar comprovante no Drive
  const dataServidor = new Date();
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = meses[dataServidor.getMonth()];
  const diaCorrenteNum = dataServidor.getDate();
  const diaCorrente = diaCorrenteNum < 10 ? "0" + diaCorrenteNum : String(diaCorrenteNum);
  
  const pastaComprovantes = getNestedFolder(["Comprovantes", nomeMes, diaCorrente]);
  
  const mimeType = payload.fileBase64.split(';')[0].split(':')[1];
  const base64Data = payload.fileBase64.split(',')[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, "Comprovante_" + payload.fileName);
  
  const file = pastaComprovantes.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileUrl = file.getUrl();
  
  // Atualizar a Planilha (Coluna 11 = Status Pagamento, Coluna 12 = Comprovante Pix)
  sheet.getRange(rowIndex, 11).setValue("Pago");
  sheet.getRange(rowIndex, 12).setValue(fileUrl);
  
  return formatJsonOutput({ status: "sucesso", comprovanteUrl: fileUrl });
}

function updatePaymentStatus(ss, payload) {
  let sheet = ss.getSheetByName("Registros");
  if (!sheet) return formatJsonOutput({ status: "erro", mensagem: "Aba Registros não encontrada" });
  
  const rowIndex = findRowIndex(sheet, payload.cpf, payload.dataHora);
  if (rowIndex === -1) {
    return formatJsonOutput({ status: "erro", mensagem: "Freelancer não encontrado na planilha" });
  }
  
  const status = payload.pago ? "Pago" : "Pendente";
  sheet.getRange(rowIndex, 11).setValue(status);
  
  return formatJsonOutput({ status: "sucesso" });
}

function findRowIndex(sheet, cpf, dataHora) {
  const data = sheet.getDataRange().getValues();
  const cleanCpf = cpf.replace(/\D/g, "");
  
  let targetDateStr = "";
  try {
    let dStr = dataHora.trim();
    if (dStr.includes('T')) {
      const datePart = dStr.split('T')[0];
      const partes = datePart.split('-');
      targetDateStr = `${partes[2]}/${partes[1]}/${partes[0]}`;
    } else if (dStr.includes('/')) {
      targetDateStr = dStr.split(' ')[0];
    }
  } catch(e) {}
  
  if (!targetDateStr) return -1;
  
  for (let i = 1; i < data.length; i++) {
    const rowCpf = String(data[i][2]).replace(/\D/g, "");
    if (rowCpf !== cleanCpf) continue;
    
    const cellValue = data[i][0];
    let rowDateStr = "";
    if (cellValue instanceof Date) {
      rowDateStr = Utilities.formatDate(cellValue, "America/Sao_Paulo", "dd/MM/yyyy");
    } else if (cellValue) {
      let dStr = String(cellValue).trim();
      if (dStr.includes('T')) {
        const datePart = dStr.split('T')[0];
        const partes = datePart.split('-');
        rowDateStr = `${partes[2]}/${partes[1]}/${partes[0]}`;
      } else if (dStr.includes('/')) {
        rowDateStr = dStr.split(' ')[0];
      }
    }
    
    if (rowDateStr === targetDateStr) {
      return i + 1;
    }
  }
  return -1;
}

function deleteFreelancer(ss, payload) {
  let sheet = ss.getSheetByName("Registros");
  if (!sheet) return formatJsonOutput({ status: "erro", mensagem: "Aba Registros não encontrada" });
  
  const rowIndex = findRowIndex(sheet, payload.cpf, payload.dataHora);
  if (rowIndex === -1) {
    return formatJsonOutput({ status: "erro", mensagem: "Freelancer não encontrado na planilha" });
  }
  
  sheet.deleteRow(rowIndex);
  return formatJsonOutput({ status: "sucesso" });
}
