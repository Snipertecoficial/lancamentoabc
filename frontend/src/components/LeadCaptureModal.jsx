import React, { useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerPortal, DrawerOverlay, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import LeadForm from "@/components/LeadForm";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { track } from "@/lib/radar";
import { modalFormId } from "@/lib/leadCapture";

const OVERLAY = "z-[10020] bg-[#020A16]/75 backdrop-blur-[3px]";
const SURFACE = "bg-[linear-gradient(165deg,#12294A_0%,#0A1930_70%)] text-[#F0F5FA] border-[#5B95CE]/30 shadow-[0_40px_90px_-30px_rgba(0,0,0,.85)]";

// Name + WhatsApp before any broker chat. Dialog on desktop, bottom sheet (vaul) below 768px.
// Both trap focus, close on Esc / overlay / the X button, and put the cursor in "Nome" on open.
// While `busy` (a lead in flight) nothing closes it: the provider ignores close requests, the X is
// disabled and the sheet cannot be dragged away.
const LeadCaptureModal = ({ open, source, mobile, busy = false, onBusyChange, onOpenChange, onCloseAutoFocus }) => {
  const contentRef = useRef(null);
  const formId = modalFormId(source);

  useEffect(() => {
    if (open) track("form_view", { form_id: formId });
  }, [open, formId]);

  const focusName = (e) => {
    e.preventDefault();
    const el = contentRef.current && contentRef.current.querySelector('input[name="name"]');
    if (el) el.focus();
  };

  const Title = mobile ? DrawerTitle : DialogTitle;
  const Description = mobile ? DrawerDescription : DialogDescription;
  const Close = mobile ? DrawerClose : DialogClose;

  const body = (
    <>
      <Close
        aria-label="Fechar"
        disabled={busy}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-[#F0F5FA]/70 transition-colors hover:bg-white/10 hover:text-[#F0F5FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7DB4E8] disabled:pointer-events-none disabled:opacity-30"
      >
        <X size={20} aria-hidden="true" />
      </Close>
      <div className="pr-10">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-2.5 py-1 font-sans text-[0.75rem] font-semibold text-[#5BE38E]">
          <WhatsAppIcon size={14} />
          Atendimento pelo WhatsApp
        </p>
        <Title className="font-display text-[1.6rem] font-normal leading-[1.15] tracking-normal text-[#F5F2ED] md:text-[1.75rem]">
          Fale com um corretor agora
        </Title>
        <Description className="mt-2 font-sans text-[0.9rem] leading-relaxed text-[#F0F5FA]/70">
          Deixe seu nome e WhatsApp e siga direto para a conversa.
        </Description>
      </div>
      <div className="mt-5">
        <LeadForm variant="compact" source={source} onSendingChange={onBusyChange} />
      </div>
    </>
  );

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={!busy} shouldScaleBackground={false}>
        <DrawerPortal>
          <DrawerOverlay className={OVERLAY} />
          <DrawerPrimitive.Content
            ref={contentRef}
            onOpenAutoFocus={focusName}
            onCloseAutoFocus={onCloseAutoFocus}
            data-testid="lead-capture-modal"
            className={`fixed inset-x-0 bottom-0 z-[10021] flex max-h-[92dvh] flex-col rounded-t-[22px] border-t outline-none ${SURFACE}`}
          >
            <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-[#F0F5FA]/25" />
            <div className="relative overflow-y-auto px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{body}</div>
          </DrawerPrimitive.Content>
        </DrawerPortal>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={OVERLAY} />
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={focusName}
          onCloseAutoFocus={onCloseAutoFocus}
          data-testid="lead-capture-modal"
          className={`fixed left-1/2 top-1/2 z-[10021] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] border p-6 outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 md:p-7 ${SURFACE}`}
        >
          {body}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default LeadCaptureModal;
