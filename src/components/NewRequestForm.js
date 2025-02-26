// src/components/NewRequestForm.js
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const NewRequestForm = () => {
    const [products, setProducts] = useState([
        { product_name: '', quantity: 1, supplier: '', delivery_date: '', remarks: '' },
    ]);

    const handleAddProduct = () => {
        setProducts([...products, { product_name: '', quantity: 1, supplier: '', delivery_date: '', remarks: '' }]);
    };

    const handleRemoveProduct = (index) => {
        const newProducts = products.filter((_, i) => i !== index);
        setProducts(newProducts);
    };

    const handleChange = (index, event) => {
        const { name, value } = event.target;
        const newProducts = [...products];
        newProducts[index][name] = value;
        setProducts(newProducts);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            // 1. Crear la orden de compra
            const { data: order, error: orderError } = await supabase
                .from('OrdenCompra')
                .insert([
                    {
                        estado: 'Pendiente',
                        observaciones: 'Solicitud de compra generada desde la aplicación',
                        proveedor_id: 1, // Aquí debes obtener el ID del proveedor seleccionado
                        departamento_id: 1, // Aquí debes obtener el ID del departamento seleccionado
                        empleado_id: 1, // Aquí debes obtener el ID del empleado que realiza la solicitud
                    },
                ])
                .single();

            if (orderError) throw orderError;

            // 2. Agregar los productos a la orden
            for (const product of products) {
                const { error: productError } = await supabase
                    .from('OrdenProducto')
                    .insert([
                        {
                            orden_compra_id: order.id,
                            producto_id: 1, // Aquí debes obtener el ID del producto seleccionado
                            cantidad: product.quantity,
                        },
                    ]);

                if (productError) throw productError;
            }

            alert('Solicitud de compra enviada con éxito');
        } catch (error) {
            console.error('Error al enviar la solicitud:', error.message);
            alert('Hubo un error al enviar la solicitud');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-xl m-4 p-10 bg-white rounded shadow-xl">
            <p className="text-gray-800 font-medium">Información de la solicitud</p>

            {products.map((product, index) => (
                <div key={index} className="producto">
                    <div className="mt-2">
                        <label className="block text-sm text-gray-600">Nombre del producto</label>
                        <input
                            className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                            type="text"
                            name="product_name"
                            value={product.product_name}
                            onChange={(e) => handleChange(index, e)}
                            required
                            placeholder="Nombre del producto"
                        />
                    </div>
                    <div className="mt-2">
                        <label className="block text-sm text-gray-600">Cantidad</label>
                        <input
                            className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                            type="number"
                            name="quantity"
                            value={product.quantity}
                            onChange={(e) => handleChange(index, e)}
                            required
                            placeholder="Cantidad"
                        />
                    </div>
                    <div className="mt-2">
                        <label className="block text-sm text-gray-600">Proveedor</label>
                        <input
                            className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                            type="text"
                            name="supplier"
                            value={product.supplier}
                            onChange={(e) => handleChange(index, e)}
                            required
                            placeholder="Nombre del proveedor"
                        />
                    </div>
                    <div className="mt-2">
                        <label className="block text-sm text-gray-600">Fecha de entrega</label>
                        <input
                            className="w-full px-5 py-1 text-gray-700 bg-gray-200 rounded"
                            type="date"
                            name="delivery_date"
                            value={product.delivery_date}
                            onChange={(e) => handleChange(index, e)}
                            required
                        />
                    </div>
                    <div className="mt-2">
                        <label className="block text-sm text-gray-600">Observaciones</label>
                        <textarea
                            className="w-full px-5 py-2 text-gray-700 bg-gray-200 rounded"
                            name="remarks"
                            value={product.remarks}
                            onChange={(e) => handleChange(index, e)}
                            rows="3"
                            placeholder="Detalles adicionales"
                        />
                    </div>
                    <div className="mt-2">
                        <button
                            type="button"
                            onClick={() => handleRemoveProduct(index)}
                            className="px-4 py-2 text-white bg-red-500 rounded"
                        >
                            Eliminar producto
                        </button>
                    </div>
                    <hr className="my-4" />
                </div>
            ))}

            <div className="mt-4">
                <button
                    type="button"
                    onClick={handleAddProduct}
                    className="px-4 py-2 text-white bg-blue-500 rounded"
                >
                    Agregar otro producto
                </button>
            </div>

            <div className="mt-4">
                <button type="submit" className="px-4 py-2 text-white bg-gray-900 rounded">
                    Enviar solicitud
                </button>
            </div>
        </form>
    );
};

export default NewRequestForm; // Asegúrate de que esta línea esté presente