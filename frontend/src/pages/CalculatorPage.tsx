import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Calculator } from 'lucide-react';

export const CalculatorPage: React.FC = () => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(`${parseFloat(newValue.toFixed(7))}`);
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return firstValue / secondValue;
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const performCalculation = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(`${parseFloat(newValue.toFixed(7))}`);
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-center mb-6">
              <Calculator size={32} className="text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">Calculator</h1>
            </div>

            {/* Display */}
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <div className="text-right text-3xl font-mono font-bold text-gray-900 overflow-hidden">
                {display}
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-4 gap-3">
              {/* Row 1 */}
              <button
                onClick={clear}
                className="col-span-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => inputOperation('/')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                ÷
              </button>
              <button
                onClick={() => inputOperation('*')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                ×
              </button>

              {/* Row 2 */}
              <button
                onClick={() => inputNumber('7')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                7
              </button>
              <button
                onClick={() => inputNumber('8')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                8
              </button>
              <button
                onClick={() => inputNumber('9')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                9
              </button>
              <button
                onClick={() => inputOperation('-')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                −
              </button>

              {/* Row 3 */}
              <button
                onClick={() => inputNumber('4')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                4
              </button>
              <button
                onClick={() => inputNumber('5')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                5
              </button>
              <button
                onClick={() => inputNumber('6')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                6
              </button>
              <button
                onClick={() => inputOperation('+')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                +
              </button>

              {/* Row 4 */}
              <button
                onClick={() => inputNumber('1')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                1
              </button>
              <button
                onClick={() => inputNumber('2')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                2
              </button>
              <button
                onClick={() => inputNumber('3')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                3
              </button>
              <button
                onClick={performCalculation}
                className="row-span-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                =
              </button>

              {/* Row 5 */}
              <button
                onClick={() => inputNumber('0')}
                className="col-span-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                0
              </button>
              <button
                onClick={inputDecimal}
                className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                .
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};