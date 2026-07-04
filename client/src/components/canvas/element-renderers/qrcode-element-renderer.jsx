import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export function QrCodeRenderer({ element }) {
  const requestKey = [
    element.qrData || 'https://example.com',
    element.qrColor || '#000000',
    element.qrBgColor || '#ffffff',
    element.qrErrorLevel || 'M',
  ].join('\u0000')
  const [result, setResult] = useState({ key: '', dataUrl: '', error: false })
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    QRCode.toDataURL(element.qrData || 'https://example.com', {
      color: {
        dark: element.qrColor || '#000000',
        light: element.qrBgColor || '#ffffff',
      },
      errorCorrectionLevel: element.qrErrorLevel || 'M',
      margin: 1,
      width: 500,
    })
      .then((url) => {
        if (requestIdRef.current === requestId) setResult({ key: requestKey, dataUrl: url, error: false })
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return
        console.error(err)
        setResult({ key: requestKey, dataUrl: '', error: true })
      })
  }, [element.qrData, element.qrColor, element.qrBgColor, element.qrErrorLevel, requestKey])

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

  const dataUrl = result.key === requestKey ? result.dataUrl : ''
  const error = result.key === requestKey && result.error

  return (
    <div style={qrCodeStyle}>
      {dataUrl ? (
        <img src={dataUrl} style={qrImageStyle} alt="QR Code" draggable={false} />
      ) : error ? (
        <span style={{ color: '#991b1b', fontSize: 12 }}>QR code unavailable</span>
      ) : null}
    </div>
  )
}
