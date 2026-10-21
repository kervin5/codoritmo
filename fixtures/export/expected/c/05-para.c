/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>

int main() {
	int a[10];
	double b[3][6];
	double c;
	int i;
	int j;
	for (i=1; i<=10; ++i) {
		a[i-1] = i*10;
	}
	for (int *elemento=&(a[0]); elemento<=&(a[9]); ++elemento) {
		printf("%i\n", (*elemento));
	}
	c = 0;
	for (double *x=&(b[0][0]); x<=&(b[2][5]); ++x) {
		c = c+1;
		(*x) = c;
	}
	for (i=3; i>=1; --i) {
		for (j=1; j<=5; j+=2) {
			printf("%g\n", b[i-1][j-1]);
		}
	}
	return 0;
}
