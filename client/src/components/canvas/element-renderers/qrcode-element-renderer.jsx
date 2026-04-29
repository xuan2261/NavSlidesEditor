import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

export function QrCodeRenderer({ element }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(element.qrData || 'https://example.com', {
      color: {
        dark: element.qrColor || '#000000',
        light: element.qrBgColor || '#ffffff',
      },
      errorCorrectionLevel: element.qrErrorLevel || 'M',
      margin: 1,
      width: 500,
    })
      .then(setDataUrl)
      .catch(console.error)
  }, [element.qrData, element.qrColor, element.qrBgColor, element.qrErrorLevel])

  const qrCodeStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: element.qrBgColor || '#ffffff',
    borderRadius: element.borderRadius || 0,
    overflow: 'hidden',
  }
  const qrImageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  }

  return (
    <div style={qrCodeStyle}>
      {dataUrl ? (
        <img src={dataUrl} style={qrImageStyle} alt="QR Code" draggable={false} />
      ) : null}
    </div>
  )
}
