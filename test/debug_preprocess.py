import sys
sys.path.insert(0, 'src/engine')
from sympyWorker import SymPyWorker

worker = SymPyWorker()
raw = r"\sin(\phi_2) = \frac{C_{Ay}}{|C_A|}"
print("Preprocessed:", repr(worker.preprocess_code(raw)))
