document.addEventListener('DOMContentLoaded', () => {
    // 1. Mapeamento de Funções e Reconhecimento
    const mappingNomes = {
        'garcom': 'Garçom',
        'cumim': 'Cumim',
        'auxiliar_servicos_gerais': 'Auxiliar de Serviços Gerais',
        'auxiliar_cozinha': 'Auxiliar de Cozinha',
        'cozinheiro': 'Cozinheiro',
        'entregador': 'Entregador',
        'staff': 'Staff Interno'
    };

    const urlParams = new URLSearchParams(window.location.search);
    let tipoUrl = urlParams.get('tipo') ? urlParams.get('tipo').toLowerCase() : 'staff';
    
    // Normalizar: Se cair numa função específica, tratar internamente como grupo Staff
    let grupoPrincipal = (tipoUrl === 'entregador') ? 'entregador' : 'staff';
    
    const selectFuncao = document.getElementById('funcao');
    const groupFuncao = document.getElementById('funcao-group');

    // Lógica do Seletor de Função
    if (grupoPrincipal === 'staff') {
        // Se a URL já trouxe a função exata, trava nela
        if (mappingNomes[tipoUrl] && tipoUrl !== 'staff') {
            selectFuncao.value = tipoUrl;
            groupFuncao.classList.add('hidden'); // Já sabemos quem é, não precisa do dropdown
        } else {
            // É staff genérico, EXIBIR dropdown e exigir
            groupFuncao.classList.remove('hidden');
            selectFuncao.setAttribute('required', 'true');
        }
    } else {
        // É entregador, garantir que não pede função extra
        groupFuncao.classList.add('hidden');
        selectFuncao.removeAttribute('required');
    }

    // Pegar o nome amigável para a UI
    let labelCargo = mappingNomes[tipoUrl] || 'Staff';
    document.getElementById('page-title').innerText = `Cadastro - ${grupoPrincipal === 'staff' ? 'Staff Interno' : 'Entregador'}`;
    document.getElementById('contract-text').innerText = contratos[grupoPrincipal];

    const contractText = document.getElementById('contract-text');
    const aceitaTermosCheckbox = document.getElementById('aceita-termos');
    const labelAceitaTermos = document.getElementById('label-aceita-termos');

    contractText.addEventListener('scroll', () => {
        if (contractText.scrollTop + contractText.clientHeight >= contractText.scrollHeight - 15) {
            aceitaTermosCheckbox.removeAttribute('disabled');
            labelAceitaTermos.style.opacity = '1';
            labelAceitaTermos.style.cursor = 'pointer';
        }
    });

    setTimeout(() => {
        if (contractText.scrollHeight <= contractText.clientHeight) {
            aceitaTermosCheckbox.removeAttribute('disabled');
            labelAceitaTermos.style.opacity = '1';
            labelAceitaTermos.style.cursor = 'pointer';
        }
    }, 200);

    // 2. Lógica do MEI
    const selectMei = document.getElementById('tem-mei');
    const cnpjGroup = document.getElementById('cnpj-group');
    const inputCnpj = document.getElementById('cnpj');

    selectMei.addEventListener('change', (e) => {
        if (e.target.value === 'sim') {
            cnpjGroup.classList.remove('hidden');
            inputCnpj.setAttribute('required', 'true');
        } else {
            cnpjGroup.classList.add('hidden');
            inputCnpj.removeAttribute('required');
            inputCnpj.value = '';
        }
    });

    // 3. Lógica da Câmera e Geolocalização
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('photo-canvas');
    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnTakePhoto = document.getElementById('btn-take-photo');
    const locationDataEl = document.getElementById('location-data');
    
    let photoDataUrl = null;
    let userLocation = null;
    let stream = null;

    btnStartCamera.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            video.srcObject = stream;
            btnStartCamera.classList.add('hidden');
            btnTakePhoto.classList.remove('hidden');
        } catch (err) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                btnStartCamera.classList.add('hidden');
                btnTakePhoto.classList.remove('hidden');
            } catch (err2) {
                alert('Erro ao acessar a câmera: Por favor, dê permissão no seu navegador.');
            }
        }
    });

    btnTakePhoto.addEventListener('click', () => {
        // Tirar a foto
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        photoDataUrl = canvas.toDataURL('image/png');
        
        // Esconder vídeo, mostrar canvas
        video.classList.add('hidden');
        canvas.classList.remove('hidden');
        btnTakePhoto.classList.add('hidden');

        // Parar a câmera
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        // Pegar localização
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    locationDataEl.classList.remove('hidden');
                    locationDataEl.innerText = `📍 Localização capturada: Lat ${userLocation.lat.toFixed(4)}, Lng ${userLocation.lng.toFixed(4)}`;
                },
                (err) => {
                    alert('Erro ao capturar localização. Por favor, permita o acesso à localização.');
                    locationDataEl.classList.remove('hidden');
                    locationDataEl.style.color = '#ef4444';
                    locationDataEl.innerText = '❌ Localização não capturada.';
                }
            );
        } else {
            alert('Geolocalização não suportada neste navegador.');
        }
    });

    // 4. Lógica da Assinatura
    const signatureCanvas = document.getElementById('signature-pad');
    
    // Ajustar o canvas para alta resolução
    function resizeCanvas() {
        const ratio =  Math.max(window.devicePixelRatio || 1, 1);
        signatureCanvas.width = signatureCanvas.offsetWidth * ratio;
        signatureCanvas.height = signatureCanvas.offsetHeight * ratio;
        signatureCanvas.getContext("2d").scale(ratio, ratio);
    }
    
    // Removido o event listener de resize para não apagar a assinatura no mobile ao abrir teclado
    setTimeout(() => {
        resizeCanvas();
        signaturePad.clear();
    }, 100);

    const signaturePad = new SignaturePad(signatureCanvas, {
        backgroundColor: 'rgba(255, 255, 255, 1)',
        penColor: 'rgb(0, 0, 0)'
    });

    document.getElementById('btn-clear-signature').addEventListener('click', () => {
        signaturePad.clear();
    });

    // 5. Submissão e Geração de PDF
    const form = document.getElementById('cadastro-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!photoDataUrl) {
            alert('Por favor, tire uma foto para o cadastro.');
            return;
        }

        if (signaturePad.isEmpty()) {
            alert('Por favor, assine o contrato.');
            return;
        }

        if (!userLocation) {
            const confirmar = confirm('A localização não foi capturada. Deseja continuar mesmo assim?');
            if (!confirmar) return;
        }

        // Resolver qual é a função final (da URL ou do Dropdown)
        let funcaoFinalRaw = selectFuncao.value || tipoUrl;
        // Fallback para entregador caso não tenha caído na condicional anterior
        if (grupoPrincipal === 'entregador') funcaoFinalRaw = 'entregador';
        
        let nomeCargoFinal = mappingNomes[funcaoFinalRaw] || 'Colaborador Eventual';

        // Coletar dados
        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value,
            pix: document.getElementById('pix').value,
            mei: document.getElementById('tem-mei').value === 'sim',
            cnpj: document.getElementById('cnpj').value,
            tipo: nomeCargoFinal, // Mandar nome amigável para a Planilha
            dataHora: new Date().toLocaleString('pt-BR')
        };

        const signatureDataUrl = signaturePad.toDataURL();

        // Montar o HTML do PDF
        const pdfTemplate = document.getElementById('contract-preview');
        
        pdfTemplate.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
                <h2 style="color: #000; margin: 0; font-size: 1.1rem;">BIHAI RESTAURANTE LTDA CNPJ: 53.074.756/0001-41</h2>
                <p style="color: #555; margin: 2px 0; font-size: 0.8rem;">Av. Engenheiro Roberto Freire, 340, Loja 64 Cond Shopping Cidade Jard, Natal/RN</p>
                <h3 style="color: #000; margin: 10px 0 5px 0; font-size: 1rem;">Contrato de Prestação de Serviços de Autônomo - ${nomeCargoFinal.toUpperCase()}</h3>
                <hr style="margin: 5px 0;">
            </div>
            
            <div style="margin-bottom: 10px; font-size: 0.9rem;">
                <h3 style="color: #000; margin: 0 0 5px 0; font-size: 1rem;">Dados do Contratado</h3>
                <p style="margin: 2px 0;"><strong>Nome:</strong> ${dados.nome}</p>
                <p style="margin: 2px 0;"><strong>CPF:</strong> ${dados.cpf} | <strong>Chave PIX:</strong> ${dados.pix} (Titular)</p>
                ${dados.mei ? `<p style="margin: 2px 0;"><strong>CNPJ MEI:</strong> ${dados.cnpj}</p>` : ''}
            </div>

            <div style="margin-bottom: 10px; display: flex; align-items: flex-start; gap: 15px; font-size: 0.9rem;">
                <div>
                    <h4 style="color: #000; margin: 0 0 5px 0;">Foto</h4>
                    <img src="${photoDataUrl}" style="width: 100px; border-radius: 4px; border: 1px solid #ccc;" />
                </div>
                <div>
                    <h4 style="color: #000; margin: 0 0 5px 0;">Registro</h4>
                    <p style="margin: 2px 0;"><strong>Data:</strong> ${dados.dataHora}</p>
                    <p style="margin: 2px 0;"><strong>Lat:</strong> ${userLocation ? userLocation.lat : 'Não registrada'}</p>
                    <p style="margin: 2px 0;"><strong>Lng:</strong> ${userLocation ? userLocation.lng : 'Não registrada'}</p>
                </div>
            </div>

            <div style="margin-bottom: 10px; font-size: 10px; line-height: 1.3; color: #333;">
                <h3 style="color: #000; margin: 0 0 5px 0; font-size: 0.9rem;">Termos do Contrato</h3>
                <p style="white-space: pre-wrap; margin: 0;">${contratos[grupoPrincipal]}</p>
                <p style="margin-top: 5px;"><strong>Status:</strong> Aceito digitalmente pelo contratado.</p>
            </div>

            <div style="text-align: center; margin-top: 15px;">
                <img src="${signatureDataUrl}" style="max-height: 60px; border-bottom: 1px solid #000;" />
                <p style="margin: 2px 0; font-size: 0.9rem;"><strong>${dados.nome}</strong></p>
                <p style="font-size: 10px; color: #666; margin: 0;">Assinatura Digital</p>
            </div>
        `;

        // Gerar o PDF
        const formCard = document.getElementById('form-card');
        const btnSubmit = document.getElementById('btn-submit');
        
        btnSubmit.innerText = 'Finalizando Cadastro...';
        btnSubmit.disabled = true;

        const opt = {
            margin:       10,
            filename:     `Contrato_${nomeCargoFinal.replace(/\s+/g, '_')}_${dados.nome.replace(/\s+/g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, scrollY: 0, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Mostrar div temporariamente para renderizar
        const pdfWrapper = document.getElementById('pdf-template');
        pdfWrapper.classList.remove('hidden');
        // Fix para celulares da Apple (Safari) renderizarem corretamente
        pdfWrapper.style.position = 'fixed';
        pdfWrapper.style.top = '0';
        pdfWrapper.style.left = '0';
        pdfWrapper.style.width = '800px';
        pdfWrapper.style.zIndex = '-1000';

        try {
            // Gerar o PDF em Base64
            const pdfBase64String = await html2pdf().set(opt).from(pdfTemplate).output('datauristring');
            const base64Data = pdfBase64String.split(',')[1];

            btnSubmit.innerText = 'Enviando para o Sistema...';
            
            const payload = {
                nome: dados.nome,
                cpf: dados.cpf,
                tipo: dados.tipo,
                pix: dados.pix,
                mei: dados.mei,
                cnpj: dados.cnpj,
                dataHora: dados.dataHora,
                pdfBase64: base64Data,
                photoBase64: photoDataUrl
            };

            const GOOGLE_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzFcDpQrMWSZLP-J07L7_QNnYFfesCQ2G5CIjQzSEdDLHQ3WyYcUiaXqU-n7m2Y9HFB/exec';

            // Enviar os dados via POST para a planilha
            await fetch(GOOGLE_WEBAPP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });

            // Removemos o download automático oculto porque os celulares bloqueiam por segurança.
            // Vamos adicionar um botão de download explícito na tela de sucesso.
            
            // Sucesso
            formCard.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <h2 style="color: #10b981; margin-bottom: 1rem;">✅ Cadastro Concluído!</h2>
                    <p>Seus dados foram registrados com sucesso na Divinas Gerais.</p>
                    <p style="margin-top: 1rem; margin-bottom: 2rem; color: var(--text-muted);"></p>
                    
                    <button onclick="window.location.href='index.html'" class="btn-secondary" style="width: 100%; padding: 1rem; border-radius: 8px; background: transparent; color: white; border: 1px solid #555; cursor: pointer;">Finalizar e Voltar</button>
                </div>
            `;
        } catch (error) {
            alert('Erro ao gerar o PDF. Tente novamente.');
            btnSubmit.innerText = 'Finalizar Cadastro';
            btnSubmit.disabled = false;
        } finally {
            pdfWrapper.classList.add('hidden');
            pdfWrapper.style.position = '';
            pdfWrapper.style.left = '';
            pdfWrapper.style.width = '';
        }
    });
});
