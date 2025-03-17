import React, { useState, useEffect } from 'react';
import { Tabs, Tab, Table, Button } from 'react-bootstrap';
import RequestTable from './RequestTable';
import ConsolidationModal from './ConsolidationModal';
import OrderForm from './OrderForm';
import OrderPDF from './OrderPDF';
import OrderActions from './OrderActions';
import { supabase } from '../supabaseClient';

const AdminDashboard = ({ activeTab, solicitudesPendientes }) => {
  const [showConsolidation, setShowConsolidation] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [ordenConsolidada, setOrdenConsolidada] = useState(null);
  const [ordenesConsolidadas, setOrdenesConsolidadas] = useState([]);

  useEffect(() => {
    const cargarOrdenes = async () => {
      const { data } = await supabase
        .from('ordencompra')
        .select(`
          *,
          proveedor:proveedor_id(*),
          detalles:ordencompra_detalle(*, producto:producto_id(*) ),
          solicitudes:orden_solicitud(solicitud:solicitud_compra_id(id))
        `)
        .order('fecha_orden', { ascending: false });

      setOrdenesConsolidadas(data || []);
    };
    cargarOrdenes();
  }, []);

  const handleConsolidate = (ordenData) => {
    setOrdenConsolidada(ordenData);
    setShowOrderForm(true);
  };

  return (
    <div className="p-4">
      <Tabs activeKey={activeTab} className="mb-3">
        <Tab eventKey="solicitudes" title="Solicitudes">
          <RequestTable
            requests={solicitudesPendientes}
            withActions={true}
            onApprove={(request) => {
              setShowConsolidation(true);
            }}
            onReject={async (id) => {
              await supabase
                .from('solicitudcompra')
                .update({ estado: 'Rechazada' })
                .eq('id', id);
            }}
          />
        </Tab>

        <Tab eventKey="ordenes" title="Órdenes Consolidadas">
          <Table striped bordered hover variant="dark">
            <thead>
              <tr>
                <th>ID</th>
                <th>Proveedor</th>
                <th>Productos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenesConsolidadas.map(orden => (
                <tr key={orden.id}>
                  <td>{orden.id}</td>
                  <td>{orden.proveedor?.nombre}</td>
                  <td>
                    {orden.detalles?.map((d, i) => (
                      <div key={i}>
                        {d.producto.descripcion} (x{d.cantidad})
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`badge bg-${orden.estado === 'Borrador' ? 'warning' : 'success'}`}>
                      {orden.estado}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <OrderPDF order={orden} />
                      <OrderActions 
                        order={orden}
                        onUpdate={() => window.location.reload()}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Tab>
      </Tabs>

      <ConsolidationModal
        show={showConsolidation}
        onHide={() => setShowConsolidation(false)}
        onConsolidate={handleConsolidate}
      />

      {showOrderForm && (
        <OrderForm
          show={showOrderForm}
          onHide={() => setShowOrderForm(false)}
          ordenConsolidada={ordenConsolidada}
          onSuccess={() => {
            window.location.reload(); // Actualizar lista de órdenes
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;