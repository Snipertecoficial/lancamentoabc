import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import EspontoneLogo from "@/components/EspontoneLogo";

// TODO revisão jurídica: texto a ser validado por advogado antes/depois do go-live.

const EMAIL = "contato@espontone.com.br";

const Section = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="font-display text-2xl text-[#F0F5FA] mb-4">{title}</h2>
    <div className="space-y-3 text-[#F0F5FA]/80 leading-relaxed">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5">
    {items.map((i) => <li key={i}>{i}</li>)}
  </ul>
);

const PrivacyPage = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = "Política de Privacidade | Espontone Imóveis";
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A1930] text-[#F0F5FA] font-sans" data-testid="privacy-page">
      <header className="border-b border-[#5B95CE]/18 bg-[#061224]">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <Link to="/" aria-label="Voltar para a página inicial"><EspontoneLogo /></Link>
        </div>
      </header>

      <main className="mx-auto px-5 py-12" style={{ maxWidth: "70ch" }}>
        <h1 className="font-display text-3xl md:text-4xl text-[#F0F5FA] mb-3">Política de Privacidade</h1>
        <p className="text-sm text-[#F0F5FA]/60 mb-10">Última atualização: 17/11/2026</p>

        <Section title="1. Quem somos">
          <p>
            Esta página explica como a <strong>Espontone Imóveis</strong> (CRECI 042656-J), responsável pelo
            tratamento dos seus dados pessoais (&quot;controladora&quot;, nos termos da Lei Geral de Proteção de Dados,
            LGPD, Lei 13.709/2018), usa as informações coletadas nesta página de lançamento.
          </p>
          <p>
            Endereço: Rua das Caneleiras, 778 - Jardim. Contato:{" "}
            <a className="text-[#7DB4E8] underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <p><strong>Quando você preenche o formulário:</strong></p>
          <List items={["nome", "número de WhatsApp", "e-mail (opcional)", "sua intenção: morar ou investir (opcional)"]} />
          <p><strong>Quando você navega pela página:</strong></p>
          <List items={[
            "páginas e seções que você vê e cliques que você faz",
            "interações com o vídeo",
            "origem do acesso e campanha de anúncio que trouxe você",
            "tipo de dispositivo, navegador e tamanho de tela",
            "endereço IP, usado apenas de forma embaralhada (hash) para fins de segurança; não guardamos o seu IP em formato legível no nosso banco de dados",
          ]} />
        </Section>

        <Section title="3. Cookies e tecnologias semelhantes">
          <List items={[
            "Radar (sistema próprio): antes de você escolher, ou depois de recusar, registramos a navegação de forma anônima, sem identificador persistente. Se você aceitar, passamos a usar um identificador do navegador para ligar as visitas de um mesmo visitante; se recusar, esse identificador é removido.",
            "Google Tag Manager, Google Analytics e Google Ads: medem o uso da página e o desempenho dos anúncios. Se você recusar, essas ferramentas funcionam em modo de consentimento, sem armazenar cookies ou identificadores no seu navegador.",
            "Microsoft Clarity: carregado pelo gerenciador de tags e, quando ativado, serve para entender de forma agregada como a página é usada (mapas de cliques e rolagem).",
          ]} />
        </Section>

        <Section title="4. Para que usamos seus dados">
          <List items={[
            "entrar em contato com você sobre o lançamento",
            "atender você pelo WhatsApp",
            "medir e melhorar nossos anúncios e esta página",
            "proteger a página contra robôs e usos abusivos",
          ]} />
        </Section>

        <Section title="5. Bases legais">
          <List items={[
            "Consentimento: para cookies e identificadores de medição e publicidade, que você pode aceitar ou recusar.",
            "Procedimentos preliminares a pedido do titular: para responder ao seu pedido de informações sobre o imóvel.",
            "Legítimo interesse: para a segurança da página e para métricas essenciais de funcionamento.",
          ]} />
        </Section>

        <Section title="6. Compartilhamento">
          <p>Compartilhamos dados apenas com provedores necessários para o funcionamento do serviço:</p>
          <List items={[
            "Supabase: armazenamento dos dados",
            "Hostgator: hospedagem da página",
            "Google e Microsoft: métricas e anúncios",
          ]} />
          <p>
            Para medir conversões de anúncios, dados de contato são transformados por hash (SHA-256) antes do envio ao Google,
            portanto não são compartilhados em forma legível. Ainda assim, continuam sendo tratados como dados
            pessoais (pseudonimizados).
          </p>
          <p>Não vendemos seus dados pessoais.</p>
        </Section>

        <Section title="7. Por quanto tempo guardamos">
          <List items={[
            "Dados de navegação de visitantes que não se tornaram contato (lead): até 13 meses.",
            "Dados de navegação e de contato ligados a um contato (lead): enquanto houver relacionamento comercial ou até você pedir a exclusão.",
          ]} />
        </Section>

        <Section title="8. Seus direitos">
          <p>Você pode, a qualquer momento, solicitar:</p>
          <List items={[
            "acesso aos seus dados",
            "correção de dados incompletos ou desatualizados",
            "exclusão dos seus dados",
            "revogação do consentimento",
            "portabilidade dos dados",
            "informação sobre com quem compartilhamos os dados",
          ]} />
          <p>
            Para exercer qualquer desses direitos, escreva para{" "}
            <a className="text-[#7DB4E8] underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            Responderemos em até 15 dias.
          </p>
          <p>
            Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Section>

        <Section title="9. Escolhas sobre cookies">
          <p>
            Ao abrir a página, mostramos um aviso para você aceitar ou recusar os cookies. Se você recusar, o
            identificador do Radar é removido do seu navegador e as ferramentas do Google funcionam em modo de
            consentimento, sem armazenar cookies ou identificadores. Você pode mudar de ideia apagando os dados do site no seu navegador, o que faz o aviso
            aparecer de novo.
          </p>
        </Section>

        <Section title="10. Atualizações desta política">
          <p>
            Podemos atualizar esta política. A data da versão em vigor aparece no topo desta página.
            Última atualização: 17/11/2026.
          </p>
        </Section>

        <p className="pt-6 border-t border-white/10">
          <Link to="/" className="text-[#7DB4E8] underline">Voltar para a página inicial</Link>
        </p>
      </main>
    </div>
  );
};

export default PrivacyPage;
